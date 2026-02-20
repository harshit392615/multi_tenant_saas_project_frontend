// ---------------- CONFIG ----------------
const API_BASE = "https://multi-tenant-saas-project.onrender.com/api";

// ---------------- STATE ----------------
const workspaceSlug = localStorage.getItem("current_workspace");
const orgSlug = localStorage.getItem("current_org");

// ---------------- HELPERS ----------------
function getHeaders() {
    const token = localStorage.getItem("access");

    if (!token || !orgSlug) {
        throw new Error("Missing auth or org context");
    }

    return {
        "Authorization": `Bearer ${token}`,
        "X-ORG-SLUG": orgSlug
    };
}

async function fetchJSON(url) {
    const response = await fetch(url, {
        headers: getHeaders()
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}

async function postJSON(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getHeaders()
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}


// ---------------- FETCH FUNCTIONS ----------------
function fetchBoards() {
    return fetchJSON(`${API_BASE}/board/workspaces/${workspaceSlug}/boards/`);
}

function fetchNotes() {
    return fetchJSON(`${API_BASE}/notes/workspaces/${workspaceSlug}/notes/`);
}

function createBoard(name) {
    return postJSON(
        `${API_BASE}/board/workspaces/${workspaceSlug}/boards/`,
        { name }
    );
}

function createNote(title, content) {
    return postJSON(
        `${API_BASE}/notes/workspaces/${workspaceSlug}/notes/`,
        { title, content }
    );
}


// ---------------- RENDER FUNCTIONS ----------------
function renderBoards(boards) {
    const list = document.getElementById("boards-list");
    list.innerHTML = "";

    if (!boards.length) {
        list.innerHTML = "<li>No boards found</li>";
        return;
    }

    boards.forEach(board => {
        const li = document.createElement("li");
        li.dataset.slug = board.slug
        li.textContent = board.name;
        
        list.appendChild(li);
    });
}

function renderNotes(notes) {
    const list = document.getElementById("notes-list");
    list.innerHTML = "";

    if (!notes.length) {
        list.innerHTML = "<li>No notes found</li>";
        return;
    }

    notes.forEach(note => {
        const li = document.createElement("li");
        li.innerHTML = `
            <strong>${note.title}</strong><br>
            ${note.content}
        `;
        li.dataset.slug = note.slug
        list.appendChild(li);
    });
}

// ---------------- INIT ----------------
async function initWorkspaceDashboard() {
    if (!workspaceSlug) {
        alert("No workspace selected");
        return;
    }

    try {
        const [boards, notes] = await Promise.all([
            fetchBoards(),
            fetchNotes()
        ]);

        renderBoards(boards);
        renderNotes(notes);

        setupCreateBoard();
        setupCreateNote();

    } catch (err) {
        console.error("Workspace load failed:", err);
        alert("Failed to load workspace data");
    }
}


function setupCreateBoard() {
    const input = document.getElementById("board-name-input");
    const btn = document.getElementById("create-board-btn");

    if (!input || !btn) return;

    btn.addEventListener("click", async () => {
        const name = input.value.trim();
        if (!name) return alert("Board name required");

        btn.disabled = true;

        try {
            await createBoard(name);
            input.value = "";

            const boards = await fetchBoards();
            renderBoards(boards);

        } catch (err) {
            console.error("Create board failed:", err);
            alert("Failed to create board");
        } finally {
            btn.disabled = false;
        }
    });
}

function setupCreateNote() {
    const titleInput = document.getElementById("note-title-input");
    const contentInput = document.getElementById("note-content-input");
    const btn = document.getElementById("create-note-btn");

    if (!titleInput || !contentInput || !btn) return;

    btn.addEventListener("click", async () => {
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();

        if (!title || !content) {
            return alert("Title and content required");
        }

        btn.disabled = true;

        try {
            await createNote(title, content);

            titleInput.value = "";
            contentInput.value = "";

            const notes = await fetchNotes();
            renderNotes(notes);

        } catch (err) {
            console.error("Create note failed:", err);
            alert("Failed to create note");
        } finally {
            btn.disabled = false;
        }
    });
}
async function deleteWorkspace(workspaceId) {
    const response = await fetch(
        `${API_BASE}/workspace/delete/${workspaceId}`,
        {
            method: "DELETE",
            headers: getHeaders()
        }
    );

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return true;
}


document.addEventListener("DOMContentLoaded", () => {
    initWorkspaceDashboard()

    document.getElementById("boards-list")?.addEventListener("click", e => {
    const li = e.target.closest("li");
    if (!li) return;

    localStorage.setItem("current_board", li.dataset.slug);
    window.location.href = "../html/boards.html";
});


    document.getElementById("notes-list")?.addEventListener("click", e => {
    const li = e.target.closest("li");
    if (!li) return;

    localStorage.setItem("current_note", li.dataset.slug);
    window.location.href = "../html/notes.html";
});
document.getElementById("delete-workspace-btn")?.addEventListener("click", async () => {

    const workspaceId = localStorage.getItem("current_workspace_id"); // assuming slug is UUID

    if (!workspaceId) {
        return alert("No workspace selected");
    }

    const confirmDelete = confirm(
        "Are you sure you want to delete this workspace? This action cannot be undone."
    );

    if (!confirmDelete) return;

    try {
        await deleteWorkspace(workspaceId);

        alert("Workspace deleted successfully");

        localStorage.removeItem("current_workspace");
        window.location.href = "../html/dashboard.html"; // redirect after delete

    } catch (err) {
        console.error("Delete failed:", err);
        alert("Failed to delete workspace");
    }
});


});
