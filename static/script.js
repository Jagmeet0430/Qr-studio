/* ── State ──────────────────────────────────────────────────────────────── */
let currentBlobUrl = null;   // track so we can revoke on next generation
const MAX_HISTORY  = 5;
const history      = [];     // { blobUrl, label }[]


/* ── DOM refs ───────────────────────────────────────────────────────────── */
const qrText        = document.getElementById("qrText");
const charCount     = document.getElementById("charCount");
const fgColor       = document.getElementById("fgColor");
const bgColor       = document.getElementById("bgColor");
const fgHex         = document.getElementById("fgHex");
const bgHex         = document.getElementById("bgHex");
const sizeRange     = document.getElementById("sizeRange");
const sizeVal       = document.getElementById("sizeVal");
const roundedToggle = document.getElementById("roundedToggle");
const generateBtn   = document.getElementById("generateBtn");
const downloadBtn   = document.getElementById("downloadBtn");
const copyBtn       = document.getElementById("copyBtn");
const spinner       = document.getElementById("spinner");
const btnText       = generateBtn.querySelector(".btn-text");
const errorMsg      = document.getElementById("errorMsg");
const qrImage       = document.getElementById("qrImage");
const placeholder   = document.getElementById("placeholder");
const historySection = document.getElementById("historySection");
const historyList    = document.getElementById("historyList");


/* ── Live UI bindings ───────────────────────────────────────────────────── */

qrText.addEventListener("input", () => {
    charCount.textContent = `${qrText.value.length} / 2000`;
});

fgColor.addEventListener("input", () => { fgHex.textContent = fgColor.value; });
bgColor.addEventListener("input", () => { bgHex.textContent = bgColor.value; });

sizeRange.addEventListener("input", () => { sizeVal.textContent = sizeRange.value; });

// Allow Enter key to generate
qrText.addEventListener("keydown", (e) => {
    if (e.key === "Enter") generateQR();
});


/* ── Generate ───────────────────────────────────────────────────────────── */

async function generateQR() {
    const text = qrText.value.trim();

    // Client-side validation
    if (!text) {
        showError("Please enter some text or a URL.");
        return;
    }

    clearError();
    setLoading(true);

    // Build form data
    const formData = new FormData();
    formData.append("text",     text);
    formData.append("fg_color", fgColor.value.replace("#", ""));
    formData.append("bg_color", bgColor.value.replace("#", ""));
    formData.append("size",     sizeRange.value);
    formData.append("rounded",  roundedToggle.checked ? "true" : "false");

    try {
        const response = await fetch("/generate", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            // Try to get a JSON error message from the server
            let message = "Failed to generate QR code. Please try again.";
            try {
                const err = await response.json();
                if (err.error) message = err.error;
            } catch (_) { /* ignore parse errors */ }
            showError(message);
            return;
        }

        const blob = await response.blob();

        // Revoke previous blob URL to free memory
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
        }
        currentBlobUrl = URL.createObjectURL(blob);

        // Show image
        qrImage.src = currentBlobUrl;
        qrImage.hidden = false;
        placeholder.hidden = true;
        downloadBtn.disabled = false;
        copyBtn.hidden = false;

        // Add to history
        addToHistory(currentBlobUrl, text);

    } catch (err) {
        showError("Network error. Make sure the server is running.");
        console.error("QR generation error:", err);
    } finally {
        setLoading(false);
    }
}


/* ── Download ───────────────────────────────────────────────────────────── */

function downloadQR() {
    if (!currentBlobUrl) return;

    const label  = qrText.value.trim().slice(0, 30).replace(/[^a-z0-9]/gi, "_") || "qr_code";
    const anchor = document.createElement("a");
    anchor.href     = currentBlobUrl;
    anchor.download = `${label}.png`;
    anchor.click();
}


/* ── Copy to clipboard ──────────────────────────────────────────────────── */

async function copyQR() {
    if (!currentBlobUrl) return;

    try {
        const res   = await fetch(currentBlobUrl);
        const blob  = await res.blob();
        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
        ]);
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy Image"; }, 2000);
    } catch (_) {
        copyBtn.textContent = "Copy unsupported";
        setTimeout(() => { copyBtn.textContent = "Copy Image"; }, 2000);
    }
}


/* ── History ────────────────────────────────────────────────────────────── */

function addToHistory(blobUrl, label) {
    // Clone the blob URL so it persists independently
    // (we just store the same URL; revoke only on new generation above)
    history.unshift({ blobUrl, label });
    if (history.length > MAX_HISTORY) {
        const removed = history.pop();
        // Only revoke if it's not the currently displayed image
        if (removed.blobUrl !== currentBlobUrl) {
            URL.revokeObjectURL(removed.blobUrl);
        }
    }
    renderHistory();
}

function renderHistory() {
    historySection.hidden = history.length === 0;
    historyList.innerHTML = "";

    history.forEach(({ blobUrl, label }, i) => {
        const item = document.createElement("div");
        item.className = "history-item";
        item.title = label;
        item.innerHTML = `
            <img src="${blobUrl}" alt="QR ${i + 1}">
            <span>${label.slice(0, 16)}</span>
        `;
        item.addEventListener("click", () => {
            qrImage.src = blobUrl;
            qrImage.hidden = false;
            placeholder.hidden = true;
            currentBlobUrl = blobUrl;
            downloadBtn.disabled = false;
            copyBtn.hidden = false;
        });
        historyList.appendChild(item);
    });
}


/* ── UI helpers ─────────────────────────────────────────────────────────── */

function setLoading(loading) {
    generateBtn.disabled = loading;
    btnText.hidden = loading;
    spinner.hidden = !loading;
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.hidden = false;
}

function clearError() {
    errorMsg.hidden = true;
    errorMsg.textContent = "";
}
