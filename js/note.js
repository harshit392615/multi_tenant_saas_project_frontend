// ==================== CONFIG & STATE ====================
const CONFIG = {
    API_BASE: "http://127.0.0.1:8000/api",
    // Adjust WS_BASE to wss:// for production
    WS_BASE: "ws://127.0.0.1:8000/ws/notes/" 
};

const urlParams = new URLSearchParams(window.location.search);
const state = {
    activeOrgSlug: localStorage.getItem("active_org"),
    noteId: urlParams.get('id'), // Ensure dashboard.js passes ?id=... to this page
    socket: null,
    docVersion: 0,
    contentText: "",
    applyingRemote: false
};

// ==================== API HELPERS ====================
function authHeaders(extra = {}) {
    const token = localStorage.getItem("access");
    return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
}

// ==================== CARET HELPERS (From your logic) ====================
function getCaretOffset(el) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return 0;

    const range = sel.getRangeAt(0);
    let count = 0;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        if (node === range.startContainer) {
            return count + range.startOffset;
        }
        count += node.textContent.length;
    }
    return count;
}

// ==================== CARET HELPERS ====================
// (Keep getCaretOffset as is, but replace setCaretOffset with this robust version)

function setCaretOffset(el, offset) {
    const sel = window.getSelection();
    if (!sel) return;
    
    const range = document.createRange();

    // Handle empty element case securely
    if (offset === 0 || el.childNodes.length === 0) {
        range.setStart(el, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
    }

    let count = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    let found = false;

    while ((node = walker.nextNode())) {
        if (count + node.length >= offset) {
            range.setStart(node, offset - count);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            found = true;
            break;
        }
        count += node.length;
    }

    // If offset is greater than total text length, place it at the very end
    if (!found) {
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }
}


// ==================== EDITOR SETUP ====================



// ==================== RENDER & OT (From your logic) ====================
function render(preserveCaret = true) {
    const el = document.getElementById("editor-canvas");

    let caret = null;
    if (preserveCaret) {
        caret = getCaretOffset(el);
    }

    el.textContent = state.contentText;

    if (caret !== null) {
        setCaretOffset(el, Math.min(caret, state.contentText.length));
    }
}

function applyOp(op) {
    if (op.type === "insert") {
        state.contentText =
            state.contentText.slice(0, op.pos) +
            op.content +
            state.contentText.slice(op.pos);
    }

    if (op.type === "delete") {
        state.contentText =
            state.contentText.slice(0, op.pos) +
            state.contentText.slice(op.pos + op.length);
    }

    state.docVersion = op.version;
}

// ==================== WEBSOCKET ====================
function connectSocket() {
    const accessToken = localStorage.getItem("access");
    const statusEl = document.getElementById("ws-status");

    if (state.socket) state.socket.close();

    state.socket = new WebSocket(`${CONFIG.WS_BASE}?note_id=${state.noteId}&token=${accessToken}`);
    state.contentText = "";
    state.docVersion = 0;

    state.socket.onopen = () => {
        statusEl.textContent = "Live";
        statusEl.className = "save-status connected";
    };

    state.socket.onmessage = e => {
        const data = JSON.parse(e.data);

        if (data.type === "init") {
            state.contentText = "";
            data.ops
                .sort((a, b) => a.version - b.version)
                .forEach(applyOp);

            state.docVersion = data.doc_version;
            render(false);
        }

        if (data.type === "insert" || data.type === "delete") {
            state.applyingRemote = true;
            applyOp(data);
            render();
            state.applyingRemote = false;
        }
    };

    state.socket.onclose = () => {
        statusEl.textContent = "Disconnected";
        statusEl.className = "save-status disconnected";
        // Attempt reconnect after a delay
        setTimeout(connectSocket, 3000);
    };
}

// ==================== EDITOR SETUP ====================
function setupEditor() {
    const el = document.getElementById("editor-canvas");

    el.addEventListener("beforeinput", e => {
        if (!state.socket || state.applyingRemote) return;
        if (state.socket.readyState !== WebSocket.OPEN) return;

        // Prevent the browser from modifying the DOM natively
        e.preventDefault();

        const caret = getCaretOffset(el);

        // 1. Handling Insertions
        if (e.inputType === "insertText" || e.inputType === "insertParagraph") {
            const insertion = e.inputType === "insertParagraph" ? "\n" : e.data;
            if (!insertion) return; // Safeguard
            
            const op = {
                type: "insert",
                pos: caret,
                content: insertion,
                base_version: state.docVersion
            };

            state.contentText =
                state.contentText.slice(0, caret) +
                insertion +
                state.contentText.slice(caret);

            // Do not let render() save the old caret position
            render(false); 
            
            // Manually advance the caret forward by the length of the insertion
            setCaretOffset(el, caret + insertion.length);
            
            state.socket.send(JSON.stringify(op));
        }

        // 2. Handling Backspace Deletions
        if (e.inputType === "deleteContentBackward" && caret > 0) {
            const op = {
                type: "delete",
                pos: caret - 1,
                length: 1,
                base_version: state.docVersion
            };

            state.contentText =
                state.contentText.slice(0, caret - 1) +
                state.contentText.slice(caret);

            // Do not let render() save the old caret position
            render(false); 
            
            // Manually pull the caret backwards by 1
            setCaretOffset(el, caret - 1);
            
            state.socket.send(JSON.stringify(op));
        }
    });
}

// ==================== INITIALIZATION & REST ====================
document.addEventListener("DOMContentLoaded", async () => {
    if (!state.noteId) {
        alert("No note ID provided.");
        window.history.back();
        return;
    }

    // Nav setup
    document.getElementById('btn-back').addEventListener('click', () => window.history.back());

    // Title Sync Logic (Requires REST API)
    const titleInput = document.getElementById('note-title-input');
    titleInput.addEventListener('change', async () => {
        const newTitle = titleInput.value.trim();
        if(!newTitle) return;
        try {
            await fetch(`${CONFIG.API_BASE}/notes/${state.noteId}/update/`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...authHeaders({ "X-ORG-SLUG": state.activeOrgSlug }) },
                body: JSON.stringify({ title: newTitle })
            });
        } catch(e) { console.error("Title update failed", e); }
    });

    // Delete Logic
    document.getElementById('btn-delete-note').addEventListener('click', async () => {
        if(confirm("Delete this note?")) {
            try {
                const res = await fetch(`${CONFIG.API_BASE}/notes/delete/${state.noteId}/`, {
                    method: "DELETE",
                    headers: authHeaders({ "X-ORG-SLUG": state.activeOrgSlug })
                });
                if(res.ok || res.status === 204) window.history.back();
            } catch(e) { alert("Failed to delete note"); }
        }
    });

    setupEditor();
    initHeartbeat();
    connectSocket();

    // Fetch initial title
    try {
        const res = await fetch(`${CONFIG.API_BASE}/notes/${state.noteId}/`, { headers: authHeaders({ "X-ORG-SLUG": state.activeOrgSlug }) });
        if(res.ok) {
            const data = await res.json();
            titleInput.value = data.title;
        }
    } catch(e) { console.warn("Could not fetch note title."); }
});

// ==================== USER PRESENCE / HEARTBEAT SSE ====================

let heartbeatConnection = null;

function initHeartbeat() {
    const token = localStorage.getItem("access");
    if (!token) return;

    // Adjust the URL to exactly match your backend's activity routing
    const heartbeatEndpoint = `${CONFIG.API_BASE}/activity/status/?token=${token}`;

    if (heartbeatConnection) heartbeatConnection.close();
    
    heartbeatConnection = new EventSource(heartbeatEndpoint);

    heartbeatConnection.onopen = () => {
        console.log("🟢 Presence Heartbeat Connected.");
    };

    // IMPORTANT: Because your Python code yields `event: heartbeat`, 
    // we MUST listen specifically for 'heartbeat', not 'message'.
    heartbeatConnection.addEventListener('heartbeat', (event) => {
        // event.data will be "1" based on your backend logic
        console.log("💓 Heartbeat tick:", event.data); 
        
        // The simple act of receiving this keeps the connection open
        // and keeps your backend Redis 'user:online:{id}' key refreshed!
    });

    heartbeatConnection.onerror = (err) => {
        console.warn("🔴 Heartbeat disconnected. Browser will auto-reconnect...", err);
        // Do NOT call heartbeatConnection.close() here, 
        // let the browser's native EventSource auto-reconnect continuously.
    };
}