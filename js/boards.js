// ==================== CONFIG ====================
const API_BASE = "https://multi-tenant-saas-project.onrender.com/api";

// ==================== STATE ====================
let workspaceSlug = localStorage.getItem("current_workspace");
let orgSlug = localStorage.getItem("current_org");
let boardSlug = localStorage.getItem("current_board");
let boardId = localStorage.getItem("current_board_id");
let currentCardSlug = null;
let currentCardId = null;

let cardsData = [];

// ==================== HELPERS ====================
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

async function request(url, method = "GET", body = null) {
    const options = {
        method,
        headers: {
            ...getHeaders()
        }
    };

    if (body) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }

    return res.status !== 204 ? res.json() : null;
}

// ==================== API ====================

function fetchCards() {
    return request(`${API_BASE}/card/boards/${boardSlug}/cards/`);
}

function createCard(payload) {
    return request(
        `${API_BASE}/card/boards/${boardSlug}/cards/`,
        "POST",
        payload
    );
}

function updateCard(cardSlug, payload) {
    return request(
        `${API_BASE}/card/boards/${cardSlug}/update/`,
        "PUT",
        payload
    );
}

function deleteCard(cardid) {
    return request(
        `${API_BASE}/card/boards/${cardid}/delete/`,
        "DELETE"
    );
}
function deleteBoard(boardId) {
    console.log(boardId)   // ✅ added
    return request(
        `${API_BASE}/board/delete/${boardId}/`,
        "DELETE"
    );
}

// ==================== RENDER ====================

function clearBoard() {
    ["backlog", "todo", "inprogress", "testing", "done"].forEach(status => {
        document.getElementById(`col-${status}`).innerHTML = "";
        document.querySelector(
            `.kanban-column[data-status="${status}"] .column-count`
        ).textContent = "0";
    });
}

function renderBoard() {
    clearBoard();

    cardsData.forEach(card => {
        const status = (card.status || "backlog")
            .toLowerCase()
            .replace(" ", "-");

        const col = document.getElementById(`col-${status}`);
        if (!col) return;

        col.appendChild(createCardElement(card));
    });

    updateCounts();
}

function createCardElement(card) {
    const el = document.createElement("div");
    el.className = "card";
    el.dataset.slug = card.slug;

    el.innerHTML = `
        <div class="card-title">${card.title || "Untitled"}</div>
        ${card.description ? `<div class="card-meta">${card.description}</div>` : ""}
    `;

    el.addEventListener("click", () => openModal(card));
    return el;
}

function updateCounts() {
    ["backlog", "todo", "inprogress", "testing", "done"].forEach(status => {
        const count = document.getElementById(`col-${status}`).children.length;
        document.querySelector(
            `.kanban-column[data-status="${status}"] .column-count`
        ).textContent = count;
    });
}

// ==================== MODAL ====================

const modalOverlay = document.getElementById("card-modal-overlay");
const modalTitle = document.getElementById("modal-title-input");
const modalDesc = document.getElementById("modal-desc-input");
const modalStatus = document.getElementById("modal-status-select");
const modalStatusDisplay = document.getElementById("modal-status-display");
const modalslug = document.getElementById("modal-card-id");
const btnSave = document.getElementById("btn-save-card");
const btnDelete = document.getElementById("btn-delete-card");
const btnClose = document.getElementById("btn-close-modal");

function openModal(card = null) {
    modalOverlay.classList.remove("hidden");

    if (card) {
        currentCardSlug = card.slug;
        currentCardId = card.id;

        modalTitle.value = card.title;
        modalDesc.value = card.description || "";
        modalStatus.value = card.status;
        modalStatusDisplay.textContent = card.status;

        btnDelete.style.display = "inline-block";
        btnSave.textContent = "Save Changes";
    } else {
        currentCardSlug = null;
        currentCardId = null;

        modalTitle.value = "";
        modalDesc.value = "";
        modalStatus.value = "backlog";
        modalStatusDisplay.textContent = "New Card";

        btnDelete.style.display = "none";
        btnSave.textContent = "Create Card";
    }
}

function closeModal() {
    modalOverlay.classList.add("hidden");
}

// ==================== ACTIONS ====================

btnSave.addEventListener("click", async () => {
    const title = modalTitle.value.trim();
    if (!title) return;

    const payload = {
        title,
        description: modalDesc.value,
        status: modalStatus.value,
        due_date: null
    };

    const cardSlug = currentCardSlug;

    if (cardSlug) {
        await updateCard(cardSlug, payload);
    } else {
        await createCard(payload);
    }

    await loadBoard();
    closeModal();
});

btnDelete.addEventListener("click", async () => {
    const cardid = currentCardId;
    if (!cardid) return;

    if (!confirm("Delete this card permanently?")) return;

    await deleteCard(cardid);
    await loadBoard();
    closeModal();
});

btnClose.addEventListener("click", closeModal);

modalOverlay.addEventListener("click", e => {
    if (e.target === modalOverlay) closeModal();
});

// ==================== SIDEBAR ====================

document.querySelectorAll(".board-item").forEach(item => {
    item.addEventListener("click", async () => {

        document.querySelectorAll(".board-item")
            .forEach(i => i.classList.remove("active"));

        item.classList.add("active");

        boardSlug = item.dataset.slug;
        boardId = item.dataset.id;   // ✅ save numeric id

        localStorage.setItem("current_board", boardSlug);
        localStorage.setItem("current_board_id", boardId);

        document.getElementById("board-title").textContent =
            item.textContent;

        await loadBoard();
    });
});
// ==================== INIT ====================

async function loadBoard() {
    cardsData = await fetchCards();
    renderBoard();
}

document.getElementById("btn-create-card")
    .addEventListener("click", () => openModal());

// ==================== THEME ====================

const toggleBtn = document.getElementById("theme-toggle");
const body = document.body;
const icon = toggleBtn.querySelector(".theme-icon");

// Load saved theme
const savedTheme = localStorage.getItem("theme");

if (savedTheme === "light") {
    body.classList.add("light");
    icon.textContent = "☀️";
} else {
    body.classList.remove("light");
    icon.textContent = "🌙";
}

// Toggle on click
toggleBtn.addEventListener("click", () => {
    body.classList.toggle("light");

    const isLight = body.classList.contains("light");

    localStorage.setItem("theme", isLight ? "light" : "dark");
    icon.textContent = isLight ? "☀️" : "🌙";
});
// ==================== DELETE BOARD ====================

const btnDeleteBoard = document.getElementById("btn-delete-board");

if (btnDeleteBoard) {
    btnDeleteBoard.addEventListener("click", async () => {

        if (!boardId) {
            alert("No board selected.");
            return;
        }

        if (!confirm("Delete this board permanently?")) return;

        try {
            await deleteBoard(boardId);

            // Remove active board from sidebar
            const activeItem = document.querySelector(".board-item.active");
            if (activeItem) activeItem.remove();

            // Clear UI
            clearBoard();
            document.getElementById("board-title").textContent = "Board Deleted";

            // Clear state
            boardSlug = null;
            boardId = null;

            localStorage.removeItem("current_board");
            localStorage.removeItem("current_board_id");

            window.location.href = "../html/workspace.html";
        } catch (error) {
            console.error(error);
            alert("Failed to delete board.");
        }
    });
}
document.addEventListener("DOMContentLoaded", async () => {
    if (boardSlug) {
        await loadBoard();
    }
});