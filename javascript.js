// Set these values to match your public GitHub repository.
const GITHUB_OWNER = "ADR1111-lab";
const GITHUB_REPO = "adrcollect.github.io";
const GITHUB_BRANCH = "main";
const GITHUB_FILES_PATH = "files";

// This password is visible in the published JavaScript. It only hides the page;
// it does not prevent people from accessing files in a public GitHub repository.
const VIEWER_PASSWORD = "20221920221920";

const unlockForm = document.querySelector("#unlock-form");
const passwordInput = document.querySelector("#password-input");
const unlockButton = document.querySelector("#unlock-button");
const lockStatus = document.querySelector("#lock-status");
const lockPanel = document.querySelector("#lock-panel");
const libraryPanel = document.querySelector("#library-panel");
const filesStatus = document.querySelector("#files-status");
const fileList = document.querySelector("#file-list");
const refreshButton = document.querySelector("#refresh-button");
const lockButton = document.querySelector("#lock-button");

function setStatus(element, message, state) {
    element.textContent = message;
    if (state) {
        element.dataset.state = state;
    } else {
        delete element.dataset.state;
    }
}

function getFilesApiUrl() {
    if (GITHUB_OWNER === "YOUR_GITHUB_USERNAME" || GITHUB_REPO === "YOUR_REPOSITORY_NAME") {
        throw new Error("Set your GitHub username and repository name near the top of javascript.js.");
    }

    const path = GITHUB_FILES_PATH
        .split("/")
        .filter(Boolean)
        .map(encodeURIComponent)
        .join("/");
    const url = new URL(
        `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${path}`
    );
    url.searchParams.set("ref", GITHUB_BRANCH);
    return url;
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

function isImage(name) {
    return /\.(avif|gif|jpe?g|png|webp)$/i.test(name);
}

function createFileItem(file) {
    if (typeof file.name !== "string" || typeof file.download_url !== "string") {
        throw new Error("GitHub returned an invalid file entry.");
    }
    const downloadUrl = new URL(file.download_url);
    if (downloadUrl.protocol !== "https:" || downloadUrl.hostname !== "raw.githubusercontent.com") {
        throw new Error(`GitHub returned an unsafe download link for "${file.name}".`);
    }

    const item = document.createElement("li");
    item.className = "file-item";

    if (isImage(file.name)) {
        const image = document.createElement("img");
        image.className = "file-preview";
        image.src = downloadUrl.href;
        image.alt = file.name;
        image.loading = "lazy";
        item.append(image);
    } else {
        const icon = document.createElement("div");
        icon.className = "file-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "FILE";
        item.append(icon);
    }

    const details = document.createElement("div");
    details.className = "file-details";
    const name = document.createElement("p");
    name.className = "file-name";
    name.textContent = file.name;
    details.append(name);

    const size = formatBytes(Number(file.size));
    if (size) {
        const metadata = document.createElement("p");
        metadata.className = "file-meta";
        metadata.textContent = size;
        details.append(metadata);
    }

    const downloadButton = document.createElement("button");
    downloadButton.className = "download-button";
    downloadButton.type = "button";
    downloadButton.textContent = "Download";
    downloadButton.addEventListener("click", () => downloadFile(downloadUrl.href, file.name, downloadButton));

    item.append(details, downloadButton);
    return item;
}

async function loadFiles() {
    refreshButton.disabled = true;
    fileList.replaceChildren();
    setStatus(filesStatus, "Loading files…");

    try {
        const response = await fetch(getFilesApiUrl(), {
            headers: { Accept: "application/vnd.github+json" }
        });
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error("Could not find the public repository or files folder. Check the settings in javascript.js.");
            }
            throw new Error(`Could not load files from GitHub (HTTP ${response.status}).`);
        }

        const result = await response.json();
        if (!Array.isArray(result)) {
            throw new Error("The GitHub files folder response was not a file list.");
        }

        const files = result
            .filter((file) => file.type === "file" && file.name !== ".gitkeep")
            .sort((a, b) => a.name.localeCompare(b.name));
        const items = files.map(createFileItem);
        fileList.replaceChildren(...items);
        setStatus(filesStatus, items.length ? `${items.length} file${items.length === 1 ? "" : "s"}` : "No files in the GitHub files folder yet.");
    } catch (error) {
        setStatus(filesStatus, error.message || "Could not load files.", "error");
    } finally {
        refreshButton.disabled = false;
    }
}

async function downloadFile(url, filename, button) {
    button.disabled = true;
    setStatus(filesStatus, `Preparing ${filename}…`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Could not download "${filename}" (HTTP ${response.status}).`);
        }
        const blobUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        setStatus(filesStatus, `Download started: ${filename}`, "success");
    } catch (error) {
        setStatus(filesStatus, error.message || `Could not download "${filename}".`, "error");
    } finally {
        button.disabled = false;
    }
}

unlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!unlockForm.reportValidity()) {
        return;
    }
    if (VIEWER_PASSWORD === "CHANGE_THIS_PASSWORD") {
        setStatus(lockStatus, "Set VIEWER_PASSWORD in javascript.js before publishing.", "error");
        return;
    }
    if (passwordInput.value !== VIEWER_PASSWORD) {
        setStatus(lockStatus, "Incorrect password.", "error");
        passwordInput.value = "";
        passwordInput.focus();
        return;
    }

    unlockButton.disabled = true;
    setStatus(lockStatus, "");
    passwordInput.value = "";
    lockPanel.hidden = true;
    libraryPanel.hidden = false;
    await loadFiles();
    unlockButton.disabled = false;
});

refreshButton.addEventListener("click", loadFiles);

lockButton.addEventListener("click", () => {
    libraryPanel.hidden = true;
    lockPanel.hidden = false;
    passwordInput.value = "";
    passwordInput.focus();
    fileList.replaceChildren();
    setStatus(filesStatus, "");
    setStatus(lockStatus, "");
});
