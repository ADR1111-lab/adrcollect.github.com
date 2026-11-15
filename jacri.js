// GET returns { files: [{ name, url, size, uploadedAt }] }.
// POST accepts repeated multipart "files" fields and an X-Upload-Password header.
// The backend must enforce the password, file-size limits, storage, and CORS.
// Set this to your backend's HTTPS file API endpoint before publishing.
const API_URL = "";

const uploadForm = document.querySelector("#upload-form");
const fileInput = document.querySelector("#file-input");
const passwordInput = document.querySelector("#upload-password");
const uploadButton = document.querySelector("#upload-button");
const uploadStatus = document.querySelector("#upload-status");
const filesStatus = document.querySelector("#files-status");
const fileList = document.querySelector("#file-list");
const refreshButton = document.querySelector("#refresh-button");

function setStatus(element, message, state) {
    element.textContent = message;
    if (state) {
        element.dataset.state = state;
    } else {
        delete element.dataset.state;
    }
}

function getApiUrl() {
    if (!API_URL) {
        throw new Error("Set API_URL in jacri.js to your backend's file API endpoint.");
    }

    let url;
    try {
        url = new URL(API_URL);
    } catch (error) {
        throw new Error("API_URL must be the full HTTPS URL of your upload backend, not a relative path.");
    }
    const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost)) {
        throw new Error("The file API must use HTTPS.");
    }
    return url;
}

async function readResponse(response) {
    const text = await response.text();
    if (!text) {
        return {};
    }

    const trimmedText = text.trimStart();
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html") || /^<!doctype html|^<html/i.test(trimmedText)) {
        return {
            message: "The server returned a web page instead of the file API. Check that API_URL points to your deployed backend, not your GitHub Pages site."
        };
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        return { message: text.slice(0, 300) };
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

function createFileItem(file, apiUrl) {
    if (!file || typeof file.name !== "string" || typeof file.url !== "string") {
        throw new Error("The file API returned an invalid file entry.");
    }

    const url = new URL(file.url, apiUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error(`The file API returned an unsafe link for "${file.name}".`);
    }

    const item = document.createElement("li");
    item.className = "file-item";

    const details = document.createElement("div");
    const link = document.createElement("a");
    link.className = "file-name";
    link.href = url.href;
    link.textContent = file.name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    details.append(link);

    const metadata = [];
    const size = formatBytes(Number(file.size));
    if (size) {
        metadata.push(size);
    }
    if (typeof file.uploadedAt === "string") {
        const date = new Date(file.uploadedAt);
        if (!Number.isNaN(date.getTime())) {
            metadata.push(date.toLocaleString());
        }
    }
    if (metadata.length) {
        const meta = document.createElement("p");
        meta.className = "file-meta";
        meta.textContent = metadata.join(" · ");
        details.append(meta);
    }

    item.append(details);
    return item;
}

async function loadFiles() {
    refreshButton.disabled = true;
    setStatus(filesStatus, "Loading files…");

    try {
        const apiUrl = getApiUrl();
        const response = await fetch(apiUrl, { headers: { Accept: "application/json" } });
        const result = await readResponse(response);
        if (!response.ok) {
            throw new Error(result.message || `Could not load files (HTTP ${response.status}).`);
        }
        if (!result || !Array.isArray(result.files)) {
            throw new Error("The file API response must contain a files array.");
        }

        const items = result.files.map((file) => createFileItem(file, apiUrl));
        fileList.replaceChildren(...items);
        setStatus(filesStatus, items.length ? `${items.length} file${items.length === 1 ? "" : "s"}` : "No files have been uploaded yet.");
    } catch (error) {
        setStatus(filesStatus, error.message || "Could not load files.", "error");
    } finally {
        refreshButton.disabled = false;
    }
}

uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!uploadForm.reportValidity()) {
        return;
    }

    const files = Array.from(fileInput.files || []);
    const password = passwordInput.value;
    uploadButton.disabled = true;
    setStatus(uploadStatus, `Uploading ${files.length} file${files.length === 1 ? "" : "s"}…`);

    try {
        const apiUrl = getApiUrl();
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file, file.name));

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "X-Upload-Password": password },
            body: formData
        });
        const result = await readResponse(response);
        if (!response.ok) {
            throw new Error(result.message || `Upload failed (HTTP ${response.status}).`);
        }

        fileInput.value = "";
        setStatus(uploadStatus, "Upload complete.", "success");
        await loadFiles();
    } catch (error) {
        setStatus(uploadStatus, error.message || "Upload failed.", "error");
    } finally {
        passwordInput.value = "";
        uploadButton.disabled = false;
    }
});

refreshButton.addEventListener("click", loadFiles);
loadFiles();
