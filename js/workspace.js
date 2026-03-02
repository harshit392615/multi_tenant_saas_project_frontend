// ==================== CONFIG & STATE ====================
const CONFIG = {
    API_BASE: "https://multi-tenant-saas-project.onrender.com/api",
    COLORS: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
};

const urlParams = new URLSearchParams(window.location.search);
const state = {
    activeOrgSlug: localStorage.getItem("active_org"),
    workspaceSlug: urlParams.get('ws') || localStorage.getItem("current_workspace"),
    workspaceDetails: { name: "", description: "" },
    boards: [],
    tasks: [],
    notes: []
};

// Ensure we fallback properly if URL param is missing
if (urlParams.get('ws')) {
    localStorage.setItem("current_workspace", urlParams.get('ws'));
}

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
            
            // If it STILL returns 401 after refresh, the session is completely dead
            if (res.status === 401) {
                forceLogout();
                throw new Error("Session expired.");
            }
        } else {
            // Refresh failed (e.g., refresh token is expired or missing)
            forceLogout();
            throw new Error("Session expired.");
        }
    }

    return res;
}

async function fetchJSON(url, headers = {}) {
    const res = await apiFetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function postJSON(url, body, headers = {}) {
    const res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function patchJSON(url, body, headers = {}) {
    const res = await apiFetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function putJSON(url, body, headers = {}) {
    const res = await apiFetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function deleteJSON(url, headers = {}, body = null) {
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
// ==================== ROUTING SYSTEM ====================
function initRouter() {
    window.addEventListener('hashchange', handleRoute);
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const route = e.currentTarget.dataset.route;
            if (route) window.location.hash = route;
            // Close mobile sidebar if applicable
            document.getElementById('sidebar')?.classList.remove('open');
        });
    });
    handleRoute();
}

function handleRoute() {
    let route = window.location.hash.replace('#', '') || 'overview';
    document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
    
    const targetView = document.getElementById(`view-${route}`);
    if (targetView) targetView.classList.add('active');
    else { document.getElementById('view-overview').classList.add('active'); route = 'overview'; }

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.route === route);
    });
}

// ==================== DATA LOADING ====================
async function loadWorkspaceData() {
    if (!state.workspaceSlug || !state.activeOrgSlug) {
        alert("Workspace context lost. Redirecting to dashboard.");
        window.location.href = "dashboard.html";
        return;
    }

    const headers = authHeaders({ "X-ORG-SLUG": state.activeOrgSlug });

    try {
        // Run fetches in parallel for speed
        const [wsDetails, boards, notes, tasks] = await Promise.all([
            fetchJSON(`${CONFIG.API_BASE}/workspace/details/${state.workspaceSlug}/`, headers).catch(() => ({ name: state.workspaceSlug, description: "Workspace Details" })),
            fetchJSON(`${CONFIG.API_BASE}/board/workspaces/${state.workspaceSlug}/boards/`, headers).catch(() => []),
            fetchJSON(`${CONFIG.API_BASE}/notes/workspaces/${state.workspaceSlug}/notes/`, headers).catch(() => []),
            fetchJSON(`${CONFIG.API_BASE}/card/workspace/${state.workspaceSlug}/list/`, headers).catch(() => [])
        ]);

        state.workspaceDetails = wsDetails;
        state.boards = boards;
        state.notes = notes;
        state.tasks = tasks;

        renderUI();
    } catch (e) {
        console.error("Failed to load workspace data", e);
    }
}

// ==================== RENDERING UI ====================
function renderUI() {
    // Top-level text and stats
    const nameStr = state.workspaceDetails.name || state.workspaceSlug;
    const workspaceid = state.workspaceDetails.id || "";
    const descStr = state.workspaceDetails.description || "";
    
    document.getElementById('sidebar-ws-name').textContent = nameStr;
    document.getElementById('header-ws-name').textContent = nameStr;
    document.getElementById('header-ws-desc').textContent = descStr;

    document.getElementById('stat-boards').textContent = state.boards.length;
    document.getElementById('stat-tasks').textContent = state.tasks.length;
    document.getElementById('stat-notes').textContent = state.notes.length;

    renderBoards();
    renderTasks();
    renderNotes();
}

function renderBoards() {
    const grid = document.getElementById('kanban-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (state.boards.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-muted); grid-column: 1/-1;">No boards created yet.</div>';
        return;
    }

    state.boards.forEach(b => {
        const total = b.totalTasks || 0;
        const comp = b.completedTasks || 0;
        const prog = total === 0 ? 0 : Math.round((comp/total)*100);

        const card = document.createElement('article');
        card.className = 'card kanban-card';
        card.dataset.name = (b.name || "").toLowerCase();
        card.onclick = () => {
            // Usually, this would redirect to the specific board URL
            window.location.href = `board.html?slug=${b.slug}`;
        };

        card.innerHTML = `
            <div class="kanban-card-header">
                <div class="mini-board-icon"><div class="mini-board-col"></div><div class="mini-board-col"></div><div class="mini-board-col"></div></div>
                <div>
                    <h3 class="kanban-title">${b.name}</h3>
                    <div class="kanban-meta">Active Board</div>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-secondary); margin-top:8px;">
                <span>${comp}/${total} tasks</span><span>${prog}%</span>
            </div>
            <div class="kanban-progress-bar"><div class="kanban-progress-fill" style="width:${prog}%;"></div></div>
        `;
        grid.appendChild(card);
    });
}

function renderTasks() {
    const list = document.getElementById('tasks-list-body');
    if (!list) return;
    list.innerHTML = '';
    
    if (state.tasks.length === 0) {
        list.innerHTML = '<div style="padding: 20px; color:var(--text-muted); text-align:center;">No tasks yet.</div>';
        return;
    }

    state.tasks.forEach(t => {
        const row = document.createElement('div');
        const status = t.status || 'todo';
        let statusText = status === 'in-progress' ? 'In Progress' : status === 'done' ? 'Done' : 'To Do';
        
        row.className = `task-row ${status === 'done' ? 'done' : ''}`;
        row.dataset.title = (t.title || "").toLowerCase();
        
        row.innerHTML = `
            <div class="task-col-main">
                <div class="task-checkbox"></div>
                <span class="task-title">${t.title}</span>
            </div>
            <div class="task-col-status">
                <span class="task-status-pill status-${status}">${statusText}</span>
            </div>
            <div class="task-col-date">
                ${new Date(t.created_at || Date.now()).toLocaleDateString()}
            </div>
        `;
        
        // Open Detail Modal
        row.onclick = () => {
            document.getElementById('detail-task-title').textContent = t.title;
            document.getElementById('detail-task-desc').textContent = t.description || "No description provided.";
            document.getElementById('detail-task-status').innerHTML = `<span class="task-status-pill status-${status}">${statusText}</span>`;
            
            const assigneeName = t.assignee?.name || "Unassigned";
            const initials = assigneeName !== "Unassigned" ? assigneeName.substring(0,2).toUpperCase() : "?";
            document.getElementById('detail-task-assignee').textContent = assigneeName;
            document.getElementById('detail-task-avatar').textContent = initials;
            
            document.getElementById('task-detail-modal').style.display = 'flex';
        };
        list.appendChild(row);
    });
}

function renderNotes() {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (state.notes.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-muted); grid-column: 1/-1;">No notes yet.</div>';
        return;
    }

    state.notes.forEach(n => {
        const card = document.createElement('article');
        card.className = 'card note-card';
        card.dataset.title = (n.title || "").toLowerCase();
        card.onclick = () => {
            const targetId = n.id || n.slug;
            if(targetId) {
                window.location.href = `note.html?id=${targetId}`;
            } else {
                alert("Note ID missing.");
            }
        };

        card.innerHTML = `
            <div class="note-header">
                <h3 class="note-title">${n.title}</h3>
                <span class="note-date">${new Date(n.created_at || Date.now()).toLocaleDateString()}</span>
            </div>
            <p class="note-preview">${n.content || "..."}</p>
        `;
        grid.appendChild(card);
    });
}

// ==================== SEARCH / FILTERING ====================
function initSearch() {
    const bindSearch = (inputId, itemSelector, datasetKey) => {
        document.getElementById(inputId)?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll(itemSelector).forEach(el => {
                const matchVal = el.dataset[datasetKey] || "";
                el.style.display = matchVal.includes(query) ? 'flex' : 'none';
            });
        });
    };

    bindSearch('search-boards', '.kanban-card', 'name');
    bindSearch('search-tasks', '.task-row', 'title');
    bindSearch('search-notes', '.note-card', 'title');

    // Close task modal
    document.getElementById('btn-close-task-detail')?.addEventListener('click', () => {
        document.getElementById('task-detail-modal').style.display = 'none';
    });
    document.getElementById('task-detail-modal')?.addEventListener('click', (e) => {
        if(e.target === e.currentTarget) e.target.style.display = 'none';
    });
    
    // Topbar mobile menu
    document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('open');
    });
}

// ==================== CREATION MODAL LOGIC ====================
function initModals() {
    const modal = document.getElementById('creation-modal');
    const modalTitle = document.getElementById('modal-title');
    const inputTitle = document.getElementById('modal-input-title');
    const inputContent = document.getElementById('modal-input-content');
    let creationType = null;

    const openModal = (type, title, showContent = false) => {
        creationType = type;
        modalTitle.textContent = title;
        inputTitle.value = '';
        inputContent.value = '';
        inputContent.style.display = showContent ? 'block' : 'none';
        modal.style.display = 'flex';
        inputTitle.focus();
    };

    document.getElementById('btn-create-kanban')?.addEventListener('click', () => openModal('board', 'New Kanban Board'));
    document.getElementById('btn-create-task')?.addEventListener('click', () => openModal('task', 'New Task'));
    document.getElementById('btn-create-note')?.addEventListener('click', () => openModal('note', 'New Note', true));

    document.getElementById('modal-cancel')?.addEventListener('click', () => modal.style.display = 'none');

    document.getElementById('modal-submit')?.addEventListener('click', async () => {
        const title = inputTitle.value.trim();
        const content = inputContent.value.trim();
        const submitBtn = document.getElementById('modal-submit');
        
        if (!title) return alert("Title is required");

        const headers = authHeaders({ "X-ORG-SLUG": state.activeOrgSlug });

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
            
            let endpoint = "";
            let payload = {};

            if (creationType === 'note') {
                endpoint = `${CONFIG.API_BASE}/notes/workspaces/${state.workspaceSlug}/notes/`;
                payload = { title, content };
            } else if (creationType === 'board') {
                endpoint = `${CONFIG.API_BASE}/board/workspaces/${state.workspaceSlug}/boards/`;
                payload = { name: title };
            } else if (creationType === 'task') {
                endpoint = `${CONFIG.API_BASE}/card/boards/${boardSlug}/cards/`;
                payload = { title };
            }

            await postJSON(endpoint, payload, headers);
            modal.style.display = 'none';
            await loadWorkspaceData(); // Reload UI to show new item
        } catch (e) {
            alert(`Failed to create ${creationType}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create';
        }
    });

    // Delete Workspace
    document.getElementById('btn-delete-workspace')?.addEventListener('click', async () => {
        if(prompt(`Type 'DELETE' to confirm deletion of this workspace:`) === 'DELETE') {
            try {
                // Adjust endpoint if needed
                const res = await fetch(`${CONFIG.API_BASE}/workspace/delete/${state.workspaceDetails.id}/`, {
    method: 'DELETE',
    headers: {
        ...authHeaders({ "X-ORG-SLUG": state.activeOrgSlug })
    }
});
                if (!res.ok) throw new Error();
                
                alert('Workspace deleted.');
                window.location.href = 'dashboard.html';
            } catch (e) {
                alert('Failed to delete workspace.');
            }
        }
    });
}

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", async () => {
    const isValidSession = await refreshAccessToken();
    if (!isValidSession) return;
    loadWorkspaceData();

    initRouter();
    initModals();
    initSearch();
    initHeartbeat();
    
    setInterval(refreshAccessToken, 8 * 60 * 1000);
    
});

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