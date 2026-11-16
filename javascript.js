// Use your Supabase project's URL and anon/public key here.
// The anon key is intended for browser use; never put a service-role key here.
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const BUCKET = "private-vault";

const loginPanel = document.querySelector("#login-panel");
const loginForm = document.querySelector("#login-form");
const emailInput = document.querySelector("#email-input");
const passwordInput = document.querySelector("#password-input");
const loginButton = document.querySelector("#login-button");
const loginStatus = document.querySelector("#login-status");
const libraryPanel = document.querySelector("#library-panel");
const adminPanel = document.querySelector("#admin-panel");
const uploadForm = document.querySelector("#upload-form");
const fileInput = document.querySelector("#file-input");
const uploadButton = document.querySelector("#upload-button");
const uploadStatus = document.querySelector("#upload-status");
const filesStatus = document.querySelector("#files-status");
const fileList = document.querySelector("#file-list");
const refreshButton = document.querySelector("#refresh-button");
const signoutButton = document.querySelector("#signout-button");

let client;
let currentRole = null;

function setStatus(element, message, state) {
    element.textContent = message;
    if (state) {
        element.dataset.state = state;
    } else {
        delete element.dataset.state;
    }
}

function showSignedOut(message, state) {
    currentRole = null;
    loginPanel.hidden = false;
    libraryPanel.hidden = true;
    adminPanel.hidden = true;
    fileList.replaceChildren();
    setStatus(loginStatus, message || "", state);
}

function showSignedIn(role) {
    currentRole = role;
    loginPanel.hidden = true;
    libraryPanel.hidden = false;
    adminPanel.hidden = role !== "admin";
    setStatus(loginStatus, "");
}

function describeError(error) {
    return error && error.message ? error.message : "Something went wrong. Please try again.";
}

function validateConfiguration() {
    if (!window.supabase || !window.supabase.createClient) {
        throw new Error("Could not load the Supabase client. Check your internet connection and try again.");
    }
    if (SUPABASE_URL === "YOUR_SUPABASE_URL" || SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY") {
        throw new Error("Add your Supabase project URL and anon key in javascript.js before using the site.");
    }
    try {
        const url = new URL(SUPABASE_URL);
        if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
            throw new Error();
        }
    } catch (error) {
        throw new Error("SUPABASE_URL must be a valid HTTPS project URL.");
    }
}

async function getRole(userId) {
    const { data, error } = await client
        .from("vault_users")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
    if (error) {
        throw error;
    }
    if (!data || !["admin", "viewer"].includes(data.role)) {
        throw new Error("This account is not authorized to use the file library.");
    }
    return data.role;
}

async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
        throw error;
    }

    try {
        const role = await getRole(data.user.id);
        showSignedIn(role);
        await loadFiles();
    } catch (error) {
        await client.auth.signOut();
        throw error;
    }
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) {
        return "";
    }
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    const units = ["KB", "MB", "GB", "TB"];
    let size = bytes / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }
    return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unit]}`;
}

function createFileItem(file, url) {
    const mimeType = file.metadata && file.metadata.mimetype;
    const item = document.createElement("li");
    item.className = "file-item";

    const details = document.createElement("div");
    details.className = "file-details";
    if (typeof mimeType === "string" && mimeType.startsWith("image/")) {
        const image = document.createElement("img");
        image.className = "file-preview";
        image.src = url;
        image.alt = file.name;
        image.loading = "lazy";
        details.append(image);
    } else {
        const icon = document.createElement("span");
        icon.className = "file-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "FILE";
        details.append(icon);
    }

    const text = document.createElement("div");
    text.className = "file-text";
    const name = document.createElement("p");
    name.className = "file-name";
    name.textContent = file.name;
    text.append(name);

    const metadata = [];
    const size = formatBytes(Number(file.metadata && file.metadata.size));
    if (size) {
        metadata.push(size);
    }
    if (file.created_at) {
        const date = new Date(file.created_at);
        if (!Number.isNaN(date.getTime())) {
            metadata.push(date.toLocaleDateString());
        }
    }
    if (metadata.length) {
        const meta = document.createElement("p");
        meta.className = "file-meta";
        meta.textContent = metadata.join(" · ");
        text.append(meta);
    }
    details.append(text);

    const actions = document.createElement("div");
    actions.className = "file-actions";
    const openLink = document.createElement("a");
    openLink.className = "file-link";
    openLink.href = url;
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.textContent = typeof mimeType === "string" && mimeType.startsWith("image/") ? "View" : "Open";
    actions.append(openLink);

    if (currentRole === "admin") {
        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteFile(file.name, deleteButton));
        actions.append(deleteButton);
    }

    item.append(details, actions);
    return item;
}

async function loadFiles() {
    refreshButton.disabled = true;
    setStatus(filesStatus, "Loading files…");
    fileList.replaceChildren();

    try {
        const { data, error } = await client.storage.from(BUCKET).list("", {
            limit: 100,
            sortBy: { column: "created_at", order: "desc" }
        });
        if (error) {
            throw error;
        }

        const files = (data || []).filter((file) => file.name && file.name !== ".emptyFolderPlaceholder");
        const items = await Promise.all(files.map(async (file) => {
            const { data: signedFile, error: signedUrlError } = await client
                .storage.from(BUCKET)
                .createSignedUrl(file.name, 60 * 10);
            if (signedUrlError) {
                throw new Error(`Could not prepare "${file.name}" for viewing: ${signedUrlError.message}`);
            }
            return createFileItem(file, signedFile.signedUrl);
        }));

        fileList.replaceChildren(...items);
        setStatus(filesStatus, items.length ? `${items.length} file${items.length === 1 ? "" : "s"}` : "No files have been uploaded yet.");
    } catch (error) {
        setStatus(filesStatus, describeError(error), "error");
    } finally {
        refreshButton.disabled = false;
    }
}

async function deleteFile(name, button) {
    if (!window.confirm(`Delete "${name}" from the private library?`)) {
        return;
    }
    button.disabled = true;
    try {
        const { error } = await client.storage.from(BUCKET).remove([name]);
        if (error) {
            throw error;
        }
        setStatus(filesStatus, `"${name}" deleted.`, "success");
        await loadFiles();
    } catch (error) {
        button.disabled = false;
        setStatus(filesStatus, describeError(error), "error");
    }
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!loginForm.reportValidity()) {
        return;
    }
    loginButton.disabled = true;
    setStatus(loginStatus, "Checking access…");
    try {
        await signIn(emailInput.value.trim(), passwordInput.value);
        passwordInput.value = "";
    } catch (error) {
        setStatus(loginStatus, describeError(error), "error");
    } finally {
        passwordInput.value = "";
        loginButton.disabled = false;
    }
});

uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (currentRole !== "admin" || !uploadForm.reportValidity()) {
        return;
    }
    const files = Array.from(fileInput.files || []);
    uploadButton.disabled = true;
    setStatus(uploadStatus, `Uploading ${files.length} file${files.length === 1 ? "" : "s"}…`);

    let uploaded = 0;
    try {
        for (const file of files) {
            const safeName = file.name.replace(/[^\w.-]+/g, "_");
            const path = `${crypto.randomUUID()}-${safeName}`;
            const { error } = await client.storage.from(BUCKET).upload(path, file, {
                cacheControl: "3600",
                upsert: false
            });
            if (error) {
                throw new Error(`Uploaded ${uploaded} of ${files.length} files. "${file.name}": ${error.message}`);
            }
            uploaded += 1;
        }
        fileInput.value = "";
        setStatus(uploadStatus, `${uploaded} file${uploaded === 1 ? "" : "s"} uploaded.`, "success");
        await loadFiles();
    } catch (error) {
        setStatus(uploadStatus, describeError(error), "error");
        if (uploaded) {
            await loadFiles();
        }
    } finally {
        uploadButton.disabled = false;
    }
});

refreshButton.addEventListener("click", loadFiles);

signoutButton.addEventListener("click", async () => {
    signoutButton.disabled = true;
    try {
        const { error } = await client.auth.signOut();
        if (error) {
            throw error;
        }
        showSignedOut("You are signed out.");
    } catch (error) {
        setStatus(filesStatus, describeError(error), "error");
    } finally {
        signoutButton.disabled = false;
    }
});

async function initialize() {
    try {
        validateConfiguration();
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data, error } = await client.auth.getSession();
        if (error) {
            throw error;
        }
        if (data.session) {
            try {
                const role = await getRole(data.session.user.id);
                showSignedIn(role);
                await loadFiles();
            } catch (error) {
                await client.auth.signOut();
                throw error;
            }
        }
    } catch (error) {
        showSignedOut(describeError(error), "error");
    }
}

initialize();