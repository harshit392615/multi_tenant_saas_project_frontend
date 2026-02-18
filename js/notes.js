const API_BASE = "http://127.0.0.1:8000/api";
const WS_BASE = "ws://127.0.0.1:8000/ws/notes/";

const workspaceSlug = localStorage.getItem("current_workspace");
const orgSlug = localStorage.getItem("current_org");
const accessToken = localStorage.getItem("access");

let socket = null;
let docVersion = 0;
let contentText = "";
let applyingRemote = false;

/* ================= HELPERS ================= */

function headers() {
    return {
        Authorization: `Bearer ${accessToken}`,
        "X-ORG-SLUG": orgSlug,
    };
}

async function fetchNotes() {
    const res = await fetch(
        `${API_BASE}/notes/workspaces/${workspaceSlug}/notes/`,
        { headers: headers() }
    );
    return res.json();
}

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
function setCaretOffset(el, offset) {
    const range = document.createRange();
    const sel = window.getSelection();

    let count = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;

    while ((node = walker.nextNode())) {
        if (count + node.length >= offset) {
            range.setStart(node, offset - count);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }
        count += node.length;
    }
}



/* ================= RENDER ================= */

function render(preserveCaret = true) {
    const el = document.getElementById("note-display-body");

    let caret = null;
    if (preserveCaret) {
        caret = getCaretOffset(el);
    }

    el.textContent = contentText;

    if (caret !== null) {
        setCaretOffset(el, Math.min(caret, contentText.length));
    }
}


/* ================= OT ================= */

function applyOp(op) {
    if (op.type === "insert") {
        contentText =
            contentText.slice(0, op.pos) +
            op.content +
            contentText.slice(op.pos);
    }

    if (op.type === "delete") {
        contentText =
            contentText.slice(0, op.pos) +
            contentText.slice(op.pos + op.length);
    }

    docVersion = op.version;
}

/* ================= SOCKET ================= */

function connect(noteId) {
    if (socket) socket.close();

    socket = new WebSocket(`${WS_BASE}?note_id=${noteId}&token=${accessToken}`);
    contentText = "";
    docVersion = 0;

    socket.onmessage = e => {
        const data = JSON.parse(e.data);

        if (data.type === "init") {
            contentText = "";
            data.ops
                .sort((a, b) => a.version - b.version)
                .forEach(applyOp);

            docVersion = data.doc_version;

            document.getElementById("empty-state").style.display = "none";
            document.getElementById("editor-view").classList.remove("hidden");

            render();
            document.getElementById("note-display-body").focus();
        }

        if (data.type === "insert" || data.type === "delete") {
            applyingRemote = true;
            applyOp(data);
            render();
            applyingRemote = false;
        }
    };
}

/* ================= EDITOR ================= */

function setupEditor() {
    const el = document.getElementById("note-display-body");

    el.addEventListener("beforeinput", e => {
        if (!socket || applyingRemote) return;

        e.preventDefault();

        const caret = getCaretOffset(el);

        if (e.inputType === "insertText") {
            const op = {
                type: "insert",
                pos: caret,
                content: e.data,
                base_version: docVersion
            };

            contentText =
                contentText.slice(0, caret) +
                e.data +
                contentText.slice(caret);

            render(true);
            socket.send(JSON.stringify(op));
        }

        if (e.inputType === "deleteContentBackward" && caret > 0) {
            const op = {
                type: "delete",
                pos: caret - 1,
                length: 1,
                base_version: docVersion
            };

            contentText =
                contentText.slice(0, caret - 1) +
                contentText.slice(caret);

            render(true);
            socket.send(JSON.stringify(op));
        }
    });
}


/* ================= BOOTSTRAP ================= */

document.addEventListener("DOMContentLoaded", async () => {
    setupEditor();

    const notes = await fetchNotes();
    const list = document.getElementById("notes-list");
    list.innerHTML = "";

    notes.forEach(n => {
        const li = document.createElement("li");
        li.textContent = n.title || "Untitled";
        li.onclick = () => connect(n.id);
        list.appendChild(li);
    });
});
