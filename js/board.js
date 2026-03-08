// ==================== CONFIG & STATE ====================
const CONFIG = {
    API_BASE: "https://multi-tenant-saas-project.onrender.com/api"
};

const urlParams = new URLSearchParams(window.location.search);
const state = {
    activeOrgSlug: localStorage.getItem("active_org"),
    workspaceSlug: localStorage.getItem("current_workspace"),
    workspaceBoards: [], // All boards in the sidebar
    activeBoardslug: urlParams.get('slug'), // The currently viewing board
    boardDetails: {},
    cards: [],
    columns: [
        { id: 'todo', title: 'To Do' },
        { id: 'inprogress', title: 'In Progress' },
        { id: 'done', title: 'Done' }
    ]
};

console.log("Initial State:", state);

// ==================== API HELPERS & 401 INTERCEPTOR ====================
function authHeaders(extra = {}) {
    const token = localStorage.getItem("access");
    return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
}

// Intelligent fetch wrapper that handles 401 retries automatically
async function apiFetch(url, options = {}) {
    let res = await fetch(url, options);

    if (res.status === 401) {
        console.warn("401 Unauthorized. Attempting to refresh token...");
        const refreshed = await refreshAccessToken();
        
        if (refreshed) {
            // Update the token in headers and retry the original request
            const newToken = localStorage.getItem("access");
            options.headers = {
                ...options.headers,
                Authorization: `Bearer ${newToken}`
            };
            
            res = await fetch(url, options);
            
            if (res.status === 401) {
                forceLogout();
                throw new Error("Session expired.");
            }
        } else {
            forceLogout();
            throw new Error("Session expired.");
        }
    }

    return res;
}

// ---------------------------------------------------------
// FIXED: AUTOMATIC HEADER INJECTION FOR ALL REQUESTS
// ---------------------------------------------------------

async function fetchJSON(url, customHeaders = {}) {
    // Automatically injects Token + Org Slug into every fetch request
    const headers = authHeaders({ "X-ORG-SLUG": state.activeOrgSlug, ...customHeaders });
    const res = await apiFetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function postJSON(url, body, customHeaders = {}) {
    // Automatically injects Token + Org Slug into every post request
    const headers = authHeaders({ "X-ORG-SLUG": state.activeOrgSlug, ...customHeaders });
    const res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function patchJSON(url, body, customHeaders = {}) {
    // Automatically injects Token + Org Slug into every patch request
    const headers = authHeaders({ "X-ORG-SLUG": state.activeOrgSlug, ...customHeaders });
    const res = await apiFetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function putJSON(url, body, customHeaders = {}) {
    // Automatically injects Token + Org Slug into every put request
    const headers = authHeaders({ "X-ORG-SLUG": state.activeOrgSlug, ...customHeaders });
    const res = await apiFetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function deleteJSON(url, customHeaders = {}, body = null) {
    // Automatically injects Token + Org Slug into every delete request
    const headers = authHeaders({ "X-ORG-SLUG": state.activeOrgSlug, ...customHeaders });
    const options = {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...headers }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await apiFetch(url, options);
    if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
    if (res.status === 204) return {}; 
    return res.json();
}

// ==================== SESSION MANAGEMENT ====================
let isRefreshing = false;
let refreshPromise = null;

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refresh");
    if (!refreshToken) return false;

    // Prevent multiple simultaneous refresh calls if multiple APIs fail at exactly the same time
    if (isRefreshing) return refreshPromise;

    isRefreshing = true;
    
    refreshPromise = (async () => {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/auth/refresh/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh: refreshToken })
            });

            if (!response.ok) return false;

            const data = await response.json();
            
            // Save new tokens to local storage immediately
            if (data.access) localStorage.setItem("access", data.access);
            if (data.refresh) localStorage.setItem("refresh", data.refresh); 
            
            console.log("Session refreshed successfully in background.");
            return true;

        } catch (error) {
            console.error("Token refresh network error:", error);
            return false;
        } finally {
            isRefreshing = false;
        }
    })();

    return refreshPromise;
}

function forceLogout() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    window.location.href = "login.html"; 
}
// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", async () => {
    const isValidSession = await refreshAccessToken();
    if (!isValidSession){ 
        forceLogout();
        return;}

        
        if (!state.workspaceSlug) {
            alert("Workspace context lost. Redirecting to dashboard.");
        window.location.href = "dashboard.html";
        return;
    }
    
    document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('open');
    });
    
    initModals();
    initHeartbeat();
    setInterval(refreshAccessToken, 8 * 60 * 1000);
    
    loadSidebarBoards();
});
// ==================== DATA LOADING ====================

// 1. Fetch all boards for the sidebar
async function loadSidebarBoards() {
    try {
        const boards = await fetchJSON(`${CONFIG.API_BASE}/board/workspaces/${state.workspaceSlug}/boards/`).catch(() => []);
        state.workspaceBoards = boards;
        
        renderSidebar();

        // If no board is selected in URL, but we have boards, auto-select the first one
        if (!state.activeBoardslug && boards.length > 0) {
            switchBoard(boards[0].slug);
        } else if (state.activeBoardslug) {
            // Load the explicitly requested board
            loadBoardData(state.activeBoardslug);
        }

    } catch (error) {
        console.error("Failed to load workspace boards", error);
        document.getElementById('sidebar-boards-list').innerHTML = `<li style="padding:12px; color:var(--error);">Failed to load.</li>`;
    }
}

// 2. Fetch specific data for the clicked board
async function loadBoardData(boardslug) {
    state.activeBoardslug = boardslug;
    
    // Update URL without reloading the page (Good UX)
    window.history.pushState({}, '', `?slug=${boardslug}`);
    
    renderSidebar(); // Update active highlight in sidebar
    
    try {
        const board = await fetchJSON(`${CONFIG.API_BASE}/board/details/${boardslug}/`).catch(() => ({ name: "Board Data Missing" }));
        state.boardDetails = board;
        document.getElementById('board-name-display').textContent = board.name  || "Untitled Board";

        const cards = await fetchJSON(`${CONFIG.API_BASE}/card/boards/${boardslug}/cards/`).catch(() => []);
        state.cards = cards;

        renderBoardCanvas();
    } catch (error) {
        console.error("Failed to load board specific data", error);
    }
}

// Called when a user clicks a board in the sidebar
function switchBoard(boardslug) {
    document.getElementById('board-canvas').innerHTML = '<div style="color:var(--text-muted); padding:24px;">Loading board...</div>';
    document.getElementById('sidebar')?.classList.remove('open'); // Close mobile menu if open
    loadBoardData(boardslug);
}

// ==================== RENDERING UI ====================

function renderSidebar() {
    const list = document.getElementById('sidebar-boards-list');
    list.innerHTML = '';

    if (state.workspaceBoards.length === 0) {
        list.innerHTML = `<li style="padding: 12px; color: var(--text-muted); font-size: 13px;">No boards created.</li>`;
        return;
    }

    state.workspaceBoards.forEach(board => {
        const li = document.createElement('li');
        const isActive = board.slug == state.activeBoardslug;
        
        li.className = `nav-item ${isActive ? 'active' : ''}`;
        li.innerHTML = `<span class="icon" style="color:${isActive ? 'var(--primary)' : 'var(--text-muted)'}">⏸</span> ${board.name}`;
        
        li.onclick = () => {
            if (!isActive) switchBoard(board.slug);
        };
        
        list.appendChild(li);
    });
}

function renderBoardCanvas() {
    const canvas = document.getElementById('board-canvas');
    canvas.innerHTML = '';

    if (!state.activeBoardslug) {
        return; // Empty state handles itself in HTML
    }

    state.columns.forEach(col => {
        const colEl = document.createElement('div');
        colEl.className = 'kanban-col';
        colEl.dataset.status = col.id; // Internal column ID matches status (e.g. 'todo')

        const headerEl = document.createElement('div');
        headerEl.className = 'kanban-col-header';
        
        const colCards = state.cards.filter(c => (c.status || 'todo') === col.id);
        headerEl.innerHTML = `<span>${col.title}</span> <span style="color:var(--text-muted); font-size:12px;">${colCards.length}</span>`;

        const bodyEl = document.createElement('div');
        bodyEl.className = 'kanban-col-body';
        
        // Drop Listeners
        bodyEl.addEventListener('dragover', handleDragOver);
        bodyEl.addEventListener('dragenter', handleDragEnter);
        bodyEl.addEventListener('dragleave', handleDragLeave);
        bodyEl.addEventListener('drop', handleDrop);

        // Render Cards
        colCards.forEach(card => {
            bodyEl.appendChild(createCardElement(card));
        });

        // Add Card Button
        const addBtn = document.createElement('div');
        addBtn.className = 'add-card-btn';
        addBtn.textContent = '+ Add a card';
        addBtn.onclick = () => openCardModal(null, col.id);

        colEl.appendChild(headerEl);
        colEl.appendChild(bodyEl);
        colEl.appendChild(addBtn);
        canvas.appendChild(colEl);
    });
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = 'k-card';
    el.draggable = true;
    
    // Assign BOTH slug and ID to the DOM element for respective operations
    el.dataset.slug = card.slug;
    el.dataset.id = card.id;

    el.innerHTML = `
        <div style="font-size:14px; font-weight:500; color:var(--text-primary); margin-bottom:8px;">${card.title}</div>
        ${card.description ? `<div style="font-size:12px; color:var(--text-secondary); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${card.description}</div>` : ''}
    `;

    el.addEventListener('click', () => openCardModal(card));
    el.addEventListener('dragstart', (e) => {
        el.classList.add('dragging');
        // We transfer SLUG for the drag and drop payload
        e.dataTransfer.setData('text/plain', card.slug);
        e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));

    return el;
}

// --- Drag and Drop Handlers ---
function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function handleDragEnter(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }

async function handleDrop(e) {
    e.preventDefault();
    const dropZone = e.currentTarget;
    dropZone.classList.remove('drag-over');

    const cardslug = e.dataTransfer.getData('text/plain');
    const newStatus = dropZone.parentElement.dataset.status;

    // Find element by slug
    const cardEl = document.querySelector(`.k-card[data-slug='${cardslug}']`);
    if (cardEl) dropZone.appendChild(cardEl);

    const cardObj = state.cards.find(c => c.slug == cardslug);
    if (cardObj && cardObj.status !== newStatus) {
        cardObj.status = newStatus;
        renderBoardCanvas(); // Update counts locally
        
        try {
            // Update uses SLUG
            await putJSON(`${CONFIG.API_BASE}/card/boards/${cardslug}/update/`, { 
                title: cardObj.title,
                description: cardObj.description,
                status: newStatus 
            });
        } catch (err) {
            console.error("Failed to update card status");
            loadBoardData(state.activeBoardslug); // Revert UI if it fails
        }
    }
}

// ==================== MODAL & DELETION LOGIC ====================
function initModals() {
    const modal = document.getElementById('card-modal');
    const close = () => modal.style.display = 'none';

    document.getElementById('btn-close-card').addEventListener('click', close);
    document.getElementById('btn-cancel-card').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if(e.target === modal) close(); });

    // 1. SAVE CARD (Updates via Slug, Creates via Board Slug)
    document.getElementById('btn-save-card').addEventListener('click', async (e) => {
        if (!state.activeBoardslug) return alert("Select a board first!");

        const btn = e.target;
        const slug = document.getElementById('card-slug-input').value; // For Updates
        const title = document.getElementById('card-title-input').value.trim();
        const desc = document.getElementById('card-desc-input').value.trim();
        const status = document.getElementById('card-status-input').value;

        if (!title) return alert("Title is required");

        btn.disabled = true; btn.textContent = 'Saving...';

        try {
            if (slug) {
                // Update existing card (Using SLUG)
                await putJSON(`${CONFIG.API_BASE}/card/boards/${slug}/update/`, { title, description: desc, status});
            } else {
                // Create new card (Using Board SLUG)
                await postJSON(`${CONFIG.API_BASE}/card/boards/${state.activeBoardslug}/cards/`, { title, description: desc, status });
            }
            close();
            await loadBoardData(state.activeBoardslug); 
        } catch (err) { alert("Failed to save card."); } 
        finally { btn.disabled = false; btn.textContent = 'Save Card'; }
    });

    // 2. DELETE CARD (Strictly uses ID)
    document.getElementById('btn-delete-card').addEventListener('click', async () => {
        const id = document.getElementById('card-id-input').value; // Explicitly getting ID
        if (!id) return;

        if (confirm("Are you sure you want to delete this card?")) {
            try {
                // Delete using ID
                await deleteJSON(`${CONFIG.API_BASE}/card/boards/${id}/delete/`);
                close();
                await loadBoardData(state.activeBoardslug);
            } catch (err) { alert("Failed to delete card."); }
        }
    });

    // 3. DELETE BOARD (Strictly uses ID)
    document.getElementById('btn-delete-board')?.addEventListener('click', async () => {
        const boardId = state.boardDetails.id; // Extract ID from loaded board details
        if (!boardId) return alert("No board selected or board ID missing.");

        if (confirm("Are you sure you want to permanently delete this entire board and all its cards?")) {
            try {
                // Delete using ID
                await deleteJSON(`${CONFIG.API_BASE}/board/details/${boardId}/`);
                
                // Clear active board state and reload sidebar
                state.activeBoardslug = null;
                window.history.pushState({}, '', window.location.pathname); // Clear slug from URL
                document.getElementById('board-canvas').innerHTML = '<div class="empty-board-state"><h3>Board Deleted</h3><p>Select another board.</p></div>';
                
                await loadSidebarBoards();
            } catch (err) {
                alert("Failed to delete board.");
            }
        }
    });
}

// Opens the modal, sets both SLUG (for edits) and ID (for deletes)
window.openCardModal = function(card = null, defaultStatus = 'todo') {
    const modal = document.getElementById('card-modal');
    const titleEl = document.getElementById('card-modal-title');
    const deleteBtn = document.getElementById('btn-delete-card');

    if (card) {
        titleEl.textContent = 'Edit Card';
        document.getElementById('card-slug-input').value = card.slug;
        document.getElementById('card-id-input').value = card.id; // Assign ID for deletion
        document.getElementById('card-status-input').value = card.status;
        document.getElementById('card-title-input').value = card.title;
        document.getElementById('card-desc-input').value = card.description || '';
        deleteBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'New Card';
        document.getElementById('card-slug-input').value = '';
        document.getElementById('card-id-input').value = ''; // No ID for new cards
        document.getElementById('card-status-input').value = defaultStatus;
        document.getElementById('card-title-input').value = '';
        document.getElementById('card-desc-input').value = '';
        deleteBtn.style.display = 'none';
    }

    modal.style.display = 'flex';
    document.getElementById('card-title-input').focus();
};

// ==================== USER PRESENCE / HEARTBEAT SSE ====================

let heartbeatConnection = null;

function initHeartbeat() {
    const token = localStorage.getItem("access");
    if (!token) return;

    // Adjust the URL to exactly match your backend's activity routing
    const heartbeatEndpoint = `${CONFIG.API_BASE}/auth/activity/status/?token=${token}`;

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