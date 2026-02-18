// ==================== CONFIG ====================
const API_BASE = "http://127.0.0.1:8000/api";

// ==================== STATE ====================
const workspaceSlug = localStorage.getItem("current_workspace");
const orgSlug = localStorage.getItem("current_org");
let boardSlug = localStorage.getItem("current_board");

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

async function fetchJSON(url) {
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function postJSON(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getHeaders()
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}
async function putJSON(url, body) {
    const res = await fetch(url, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getHeaders()
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}


// ==================== FETCH ====================
function fetchCards() {
    return fetchJSON(`${API_BASE}/card/boards/${boardSlug}/cards/`);
}

function createCard(payload) {
    return postJSON(
        `${API_BASE}/card/boards/${boardSlug}/cards/`,
        payload
    );
}
function updateCard(cardSlug, payload) {
    return putJSON(
        `${API_BASE}/card/boards/${cardSlug}/update/`,
        payload
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
    el.dataset.slug = card.slug;   // ✅ store slug

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
const modalId = document.getElementById("modal-card-id");
const btnSave = document.getElementById("btn-save-card");
const btnDelete = document.getElementById("btn-delete-card");
const btnClose = document.getElementById("btn-close-modal");

function openModal(card = null) {
    modalOverlay.classList.remove("hidden");

    if (card) {
        modalId.value = card.slug;  // ✅ store slug
        modalTitle.value = card.title;
        modalDesc.value = card.description || "";
        modalStatus.value = card.status;
        modalStatusDisplay.textContent = card.status;
        btnDelete.style.display = "inline-block";
        btnSave.textContent = "Save Changes";
    } else {
        modalId.value = "";
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
        due_date: null   // or wire from input if present
    };

    const cardSlug = modalId.value;

    // ================= UPDATE =================
    if (cardSlug) {
        await updateCard(cardSlug, payload);
        await loadBoard();
        closeModal();
        return;
    }

    // ================= CREATE =================
    await createCard(payload);
    await loadBoard();
    closeModal();
});


btnDelete.addEventListener("click", () => {
    const id = modalId.value;
    if (!id) return;

    if (confirm("Delete this card?")) {
        cardsData = cardsData.filter(c => c.id != id);
        renderBoard();
        closeModal();
    }
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
        localStorage.setItem("current_board", boardSlug);
        document.getElementById("board-title").textContent = item.textContent;

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

document.addEventListener("DOMContentLoaded", loadBoard);
