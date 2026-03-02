// ==================== CONFIG & STATE ====================
const CONFIG = {
    API_BASE: "https://multi-tenant-saas-project.onrender.com/api",
    ENDPOINTS: {
        ORG_LIST: "/organization/list/",
        ORG_CREATE: "/organization/create/",
        WORKSPACE_LIST: "/workspace/",
        WORKSPACE_CREATE: "/workspace/",
        
        // --- Added Endpoints for Real Data Fetching ---
        // Adjust these to match your actual backend URL structure!
        NOTES_LIST: "/notes/list/",
        KANBAN_LIST: "/board/list/",
        TASKS_LIST: "/card/list",
        MEMBERS_LIST: "/organization/membership/",
        MEMBER_UPDATE: "/organization/membership/update/", // Used for PATCH (role) and DELETE
        MEMBER_INVITE: "/invites/invite/",
        SUBSCRIPTION: "/organization/subscription/",
        ACTIVITY_LOGS: "/activities/activities/",
        TOKEN_REFRESH: "/auth/refresh/",
        SUBSCRIPTION: "/organization/subscription/",
    },
    COLORS: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
};

const state = {
    organizations: [],
    workspaces: [],
    notes: [],
    kanbanBoards: [],
    tasks: [],
    members: [],
    invoices: [],
    activeOrgSlug: null,
    activities: [],
    currentPlan: null, 
    pendingPaymentPayload: null
};

// ==================== API HELPERS & 401 INTERCEPTOR ====================
function authHeaders(extra = {}) {
    const token = localStorage.getItem("access");
    return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
}

// Global interceptor: If ANY request returns 401, instantly log the user out
function check401(res) {
    if (res.status === 401) {
        forceLogout();
        throw new Error("Unauthorized - Session expired.");
    }
}

async function fetchJSON(url, headers = {}) {
    const res = await fetch(url, { headers });
    check401(res);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function postJSON(url, body, headers = {}) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
    });
    check401(res);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function patchJSON(url, body, headers = {}) {
    const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
    });
    check401(res);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function putJSON(url, body, headers = {}) {
    const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
    });
    check401(res);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function deleteJSON(url, headers = {}, body = null) {
    const options = {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...headers }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    check401(res);
    if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
    if (res.status === 204) return {}; 
    return res.json();
}

// ==================== ROUTING SYSTEM ====================
function initRouter() {
    window.addEventListener('hashchange', handleRoute);
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const route = e.currentTarget.dataset.route;
            if (route) {
                window.location.hash = route;
                document.getElementById('sidebar').classList.remove('open');
            }
        });
    });
    handleRoute();
}

function handleRoute() {
    let route = window.location.hash.replace('#', '') || 'dashboard';
    document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active'));
    
    const targetView = document.getElementById(`view-${route}`);
    if (targetView) {
        targetView.classList.add('active');
    } else {
        document.getElementById('view-dashboard').classList.add('active');
        route = 'dashboard';
    }

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.route === route);
    });
}

// ==================== DATA LOADING ====================
async function loadData() {
    try {
        // 1. Fetch Organizations
        const orgs = await fetchJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ORG_LIST}`, authHeaders());
        state.organizations = orgs;
        
        // 2. Determine Active Org
        state.activeOrgSlug = localStorage.getItem("active_org") || (orgs[0] ? orgs[0].slug : null);
        
        // Update UI for Orgs
        document.getElementById('stat-orgs').textContent = orgs.length;
        renderOrganizations(orgs);
        updateOrgSwitcherUI();

        // 3. Load Org-Specific Data
        if (state.activeOrgSlug) {
            await loadActiveOrgData();
        }
    } catch (e) {
        console.error("Failed to load dashboard data", e);
    }
}

// Fetches all data belonging to the currently selected organization
async function loadActiveOrgData() {
    const headers = authHeaders({ "X-ORG-SLUG": state.activeOrgSlug });

    try {
        // Workspaces
        const wss = await fetchJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.WORKSPACE_LIST}`, headers);
        state.workspaces = wss;
        document.getElementById('stat-workspaces').textContent = wss.length;
        renderWorkspaces(wss);

        // Notes
        const notes = await fetchJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.NOTES_LIST}`, headers);
        state.notes = notes;
        renderNotes(notes);

        // Kanban Boards
        const boards = await fetchJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.KANBAN_LIST}`, headers);
        state.kanbanBoards = boards;
        renderKanbanBoards(boards);

        // Tasks
        const tasks = await fetchJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.TASKS_LIST}`, headers);
        state.tasks = tasks;
        renderTasks(tasks);

        // Members
        const members = await fetchJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.MEMBERS_LIST}`, headers);
        state.members = members;
        renderMembers(members);

        //Billing
        loadBillingData();

        // Activity Logs
        const activities = await fetchJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ACTIVITY_LOGS}`, headers);
        console.log("Fetched activities:", activities);
        state.activities = activities;
        renderActivities(activities);

        

    } catch (e) {
        console.error("Failed to load organization-specific data", e);
    }
    
}

// ==================== BILLING & SUBSCRIPTION LOGIC ====================

async function loadBillingData() {
    try {
        // GET Request to fetch current subscription
        const subData = await fetchJSON(
            `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.SUBSCRIPTION}`, 
            authHeaders({ "X-ORG-SLUG": state.activeOrgSlug })
        );
        
        // Extract plan details (Adjust variable names based on your actual backend response)
        state.currentPlan = subData.title ? subData.title.toLowerCase() : 'basic'; 
        console.log("Current subscription data:", subData);

        duration = subData.billing_cycle === "Yearly" ? 365 : subData.billing_cycle === "Monthly" ? 30 : subData.billing_cycle === "unlimited" ? none : 30;
        
        // Render the Banner
        document.getElementById('active-plan-name').textContent = state.currentPlan.charAt(0).toUpperCase() + state.currentPlan.slice(1) + " Plan";
        document.getElementById('active-plan-start').textContent = subData.start_date ? new Date(subData.start_date).toLocaleDateString() : '--';
        document.getElementById('active-plan-cycle').textContent = subData.billing_cycle || 'Monthly';
        document.getElementById('active-plan-status').textContent = subData.is_active ? 'Active' : 'Inactive';

        // Reset all cards
        document.querySelectorAll('.pricing-card').forEach(card => {
            card.classList.remove('active-plan');
            card.querySelector('.active-badge').style.display = 'none';
            const btn = card.querySelector('.plan-btn');
            btn.disabled = false;
            btn.textContent = `Select ${card.querySelector('h3').textContent}`;
        });

        // Highlight Current Plan Card
        const currentCard = document.getElementById(`card-${state.currentPlan}`);
        if (currentCard) {
            currentCard.classList.add('active-plan');
            currentCard.querySelector('.active-badge').style.display = 'block';
            const btn = currentCard.querySelector('.plan-btn');
            btn.disabled = true;
            btn.textContent = 'Current Plan';
        }

    } catch (e) {
        console.error("Failed to load billing data", e);
        // Fallback if no subscription exists yet
        state.currentPlan = 'basic';
        document.getElementById('active-plan-name').textContent = "Free Plan";
    }
}
// ==================== RENDERING LOGIC ====================

function renderOrganizations(orgs) {
    const grid = document.getElementById('orgs-grid');
    if (!grid) return;
    grid.innerHTML = '';

    orgs.forEach(org => {
        const memberCount = org.member_count || 1; 
        const wsCount = org.workspace_count || 0;
        const plan = org.type === 'personal' ? 'Starter' : 'Pro';

        const card = document.createElement('article');
        card.className = 'card';
        card.onclick = () => {
            state.activeOrgSlug = org.slug;
            localStorage.setItem("active_org", org.slug);
            updateOrgSwitcherUI();
            loadActiveOrgData();
        }

        card.innerHTML = `
            <div class="org-card-header">
                <div class="org-avatar" style="background: #1e293b">${org.name.substring(0, 2).toUpperCase()}</div>
                <div>
                    <h3>${org.name}</h3>
                    <span class="org-badge">${plan}</span>
                </div>
            </div>
            <div class="org-stats">
                <span>${memberCount} members</span>
                <span>${wsCount} workspaces</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderWorkspaces(wss) {
    const dashGrid = document.getElementById('projects-grid');
    const allGrid = document.getElementById('all-workspaces-grid');
    const orgNameDisplay = document.getElementById('ws-org-name-display');
    const emptyMsg = document.getElementById('empty-workspaces-msg');

    if (dashGrid) dashGrid.innerHTML = '';
    if (allGrid) allGrid.innerHTML = '';

    const activeOrg = state.organizations.find(o => o.slug === state.activeOrgSlug);
    if (orgNameDisplay && activeOrg) orgNameDisplay.textContent = activeOrg.name;

    if (wss.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
    } else {
        if (emptyMsg) emptyMsg.style.display = 'none';
    }

    wss.forEach((ws, i) => {
        const color = CONFIG.COLORS[i % CONFIG.COLORS.length];
        
        // Helper function to create a fully functional card every time it's called
        const createCard = () => {
            const card = document.createElement('article');
            card.className = 'card workspace-card';
            card.dataset.name = ws.name.toLowerCase();
            
            // The click listener is now attached directly to every single card instance
            card.onclick = () => {
                if (activeOrg) localStorage.setItem("active_org", activeOrg.slug);
                window.location.href = `workspace.html?ws=${ws.slug}`;
            };

            card.innerHTML = `
                <div class="ws-dot" style="background-color: ${color}"></div>
                <h3>${ws.name}</h3>
                <p>${ws.description || 'Active project management.'}</p>
            `;
            return card;
        };

        // Append a fresh card to the dashboard grid (up to 4)
        if (i < 4 && dashGrid) dashGrid.appendChild(createCard());
        
        // Append a fresh card to the all workspaces grid
        if (allGrid) allGrid.appendChild(createCard());
    });
}
function renderNotes(notes) {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (notes.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">No notes yet. Create one!</p>`;
        return;
    }

    notes.forEach(note => {
        const card = document.createElement('article');
        card.className = 'card note-card';
        card.dataset.title = (note.title || "").toLowerCase();
        card.dataset.content = (note.content || "").toLowerCase();
        
        card.onclick = () => {
            // Check if backend returns 'id' or 'slug' for the note, adjust accordingly
            const targetId = note.id || note.slug; 
            if(targetId) {
                window.location.href = `note.html?id=${targetId}`;
            } else {
                alert("Note ID missing.");
            }
        };

        card.innerHTML = `
            <div class="note-header">
                <h3 class="note-title">${note.title || "Untitled"}</h3>
                <span class="note-date">${new Date(note.created_at || Date.now()).toLocaleDateString()}</span>
            </div>
            <p class="note-preview">${note.content || "..."}</p>
        `;
        grid.appendChild(card);
    });
}

function renderKanbanBoards(boards) {
    const grid = document.getElementById('kanban-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (boards.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">No boards found. Create your first Kanban board!</p>`;
        return;
    }

    boards.forEach(board => {
        const total = board.totalTasks || 0;
        const completed = board.completedTasks || 0;
        const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

        const card = document.createElement('article');
        card.className = 'card kanban-card';
        card.dataset.name = (board.name || "").toLowerCase();
        card.onclick = () => alert(`Opening Kanban Board: ${board.name}`);

        card.innerHTML = `
            <div class="kanban-card-header">
                <div class="mini-board-icon">
                    <div class="mini-board-col"></div>
                    <div class="mini-board-col"></div>
                    <div class="mini-board-col"></div>
                </div>
                <div>
                    <h3 class="kanban-title">${board.name}</h3>
                    <div class="kanban-meta">Active ${new Date(board.updated_at || Date.now()).toLocaleDateString()}</div>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                <span>${completed}/${total} tasks</span>
                <span>${progress}%</span>
            </div>
            <div class="kanban-progress-bar">
                <div class="kanban-progress-fill" style="width: ${progress}%;"></div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderTasks(tasks) {
    const listBody = document.getElementById('tasks-list-body');
    if (!listBody) return;
    listBody.innerHTML = '';

    if (tasks.length === 0) {
        listBody.innerHTML = `<div style="padding: 32px; text-align: center; color: var(--text-muted);">No tasks match your criteria.</div>`;
        return;
    }

    tasks.forEach(task => {
        const row = document.createElement('div');
        row.className = `task-row ${task.status === 'done' ? 'done' : ''}`;
        row.dataset.title = (task.title || "").toLowerCase();
        row.dataset.status = task.status || "todo";
        
        let statusText = "To Do";
        let statusClass = "status-todo";
        if (task.status === "in-progress") { statusText = "In Progress"; statusClass = "status-in-progress"; }
        if (task.status === "done") { statusText = "Done"; statusClass = "status-done"; }

        const assigneeName = task.assignee?.name || "Unassigned";
        const initials = assigneeName !== "Unassigned" ? assigneeName.substring(0,2).toUpperCase() : "?";
        const dateStr = new Date(task.due_date || Date.now()).toLocaleDateString();

        row.innerHTML = `
            <div class="task-col-main">
                <div class="task-checkbox"></div>
                <span class="task-title">${task.title}</span>
            </div>
            <div class="task-col-assignee">
                <div class="user-avatar" style="width: 24px; height: 24px; font-size: 10px;">${initials}</div>
                <span style="font-size: 13px; color: var(--text-secondary);">${assigneeName}</span>
            </div>
            <div class="task-col-status">
                <span class="task-status-pill ${statusClass}">${statusText}</span>
            </div>
            <div class="task-col-date">${dateStr}</div>
        `;

        row.addEventListener('click', () => {
            document.getElementById('detail-task-title').textContent = task.title;
            document.getElementById('detail-task-desc').textContent = task.description || "No description provided.";
            document.getElementById('detail-task-assignee').textContent = assigneeName;
            document.getElementById('detail-task-avatar').textContent = initials;
            document.getElementById('detail-task-status').innerHTML = `<span class="task-status-pill ${statusClass}">${statusText}</span>`;
            document.getElementById('task-detail-modal').style.display = 'flex';
        });
        
        listBody.appendChild(row);
    });
}

function renderMembers(members) {
    const listBody = document.getElementById('members-list-body');
    if (!listBody) return;
    listBody.innerHTML = '';

    members.forEach(member => {
        const isOwner = member.role === "Owner";
        const initials = (member.name || member.email).substring(0, 2).toUpperCase();
        
        const row = document.createElement('div');
        row.className = 'member-row';
        row.dataset.name = (member.name || "").toLowerCase();
        row.dataset.email = (member.email || "").toLowerCase();

        let roleHTML = isOwner 
            ? `<select class="role-select" disabled><option>Owner</option></select>` 
            : `<select class="role-select" onchange="changeMemberRole('${member.email}', this.value)">
                    <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="member" ${member.role === 'member' ? 'selected' : ''}>Member</option>
                    <option value="viewer" ${member.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                </select>`;

        row.innerHTML = `
            <div class="member-col-info">
                <div class="user-avatar" style="width: 32px; height: 32px; font-size: 11px;">${initials}</div>
                <div>
                    <div style="font-weight: 500; color: var(--text-primary); font-size: 14px;">${member.name || "Unknown User"}</div>
                    <div style="color: var(--text-secondary); font-size: 12px;">${member.email}</div>
                </div>
            </div>
            <div class="member-col-status">
                <div class="availability-dot status-${member.status || 'offline'}"></div>
                <span class="status-text">${member.status === 1 ? "Active" : "Offline"}</span>
            </div>
            <div class="member-col-role">${roleHTML}</div>
            <div class="member-col-actions">
<button class="btn-remove" ${isOwner ? 'disabled' : ''} onclick="removeMember(${member.id}, '${member.name || member.email}', '${member.email}')">
    ${isOwner ? '' : 'Remove'}
</button>
            </div>
        `;
        listBody.appendChild(row);
    });
}

function renderActivities(activities) {
    const listBody = document.getElementById('activity-list-body');
    if (!listBody) return;
    listBody.innerHTML = '';

    if (!activities || activities.length === 0) {
        listBody.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">No recent activity found.</div>`;
        return;
    }

    activities.forEach(act => {
        // Assign a simple icon based on the action type (customize these based on your backend data)
        let icon = "📝";
        if (act.action === "user_joined") icon = "👋";
        if (act.action === "task_completed") icon = "✅";
        if (act.action === "workspace_created") icon = "📚";
        if (act.action === "role_updated") icon = "🛡️";

        const item = document.createElement('div');
        item.className = 'activity-item';
        
        const dateStr = new Date(act.timestamp || Date.now()).toLocaleString();

        item.innerHTML = `
            <div class="activity-icon">${icon}</div>
            <div class="activity-content">
                <div class="activity-desc">${act.description || "Performed an action"}</div>
                <span class="activity-time">${dateStr}</span>
            </div>
        `;
        listBody.appendChild(item);
    });
}

// ==================== GLOBAL INLINE HANDLERS ====================
window.changeMemberRole = async function(email, newRole) {
    try {
        await putJSON(
            `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.MEMBER_UPDATE}`, 
            { email: email, role: newRole }, 
            authHeaders({ "X-ORG-SLUG": state.activeOrgSlug })
        );
        console.log(`Changed member ${email} role to ${newRole}`);
    } catch (e) {
        alert("Failed to change role.");
        loadActiveOrgData(); // Revert UI
    }
};

window.removeMember = async function(memberId, memberName, memberEmail) {
    if(confirm(`Are you sure you want to remove ${memberName} from the organization?`)) {
        try {
            // Sends the DELETE request WITH the email in the request body
            await deleteJSON(
                `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.MEMBERS_LIST}`, 
                authHeaders({ "X-ORG-SLUG": state.activeOrgSlug }),
                { email: memberEmail } // <--- Here is the request body
            );
            await loadActiveOrgData(); // Reload list
        } catch (e) {
            alert("Failed to remove member.");
        }
    }
};

// ==================== UI & INTERACTIONS ====================

function updateOrgSwitcherUI() {
    const currentAvatar = document.getElementById('current-org-avatar');
    const currentName = document.getElementById('current-org-name');
    const dropdownList = document.getElementById('orgDropdownList');
    const activeOrg = state.organizations.find(o => o.slug === state.activeOrgSlug) || state.organizations[0];

    if (activeOrg) {
        currentName.textContent = activeOrg.name;
        currentAvatar.textContent = activeOrg.name.substring(0, 2).toUpperCase();

        // Check Permissions/Types for Dashboard/Members
        const statCardOrgs = document.getElementById('stat-card-orgs');
        const sectionOrgs = document.getElementById('section-orgs');
        const viewMembersActive = document.getElementById('members-active-state');
        const viewMembersRestricted = document.getElementById('members-restricted-state');
        const membersOrgNameDisplay = document.getElementById('members-org-name-display');

        if (activeOrg.type === 'personal') {
            if (statCardOrgs) statCardOrgs.style.display = 'flex';
            if (sectionOrgs) sectionOrgs.style.display = 'block';
            if (viewMembersActive) viewMembersActive.style.display = 'none';
            if (viewMembersRestricted) viewMembersRestricted.style.display = 'block';
        } else {
            if (statCardOrgs) statCardOrgs.style.display = 'none';
            if (sectionOrgs) sectionOrgs.style.display = 'none';
            if (viewMembersActive) viewMembersActive.style.display = 'block';
            if (viewMembersRestricted) viewMembersRestricted.style.display = 'none';
            if (membersOrgNameDisplay) membersOrgNameDisplay.textContent = activeOrg.name;
        }

        const settingOrgNameInput = document.getElementById('setting-org-name');
        if (settingOrgNameInput) settingOrgNameInput.value = activeOrg.name;

        // Rebuild Dropdown
        dropdownList.innerHTML = '';
        state.organizations.forEach(org => {
            const isActive = org.slug === state.activeOrgSlug;
            const li = document.createElement('li');
            li.className = `org-dropdown-item ${isActive ? 'active' : ''}`;
            li.dataset.slug = org.slug;
            li.innerHTML = `
                <div class="org-avatar" style="background: ${isActive ? 'transparent' : '#1e293b'}">
                    ${org.name.substring(0, 2).toUpperCase()}
                </div>
                <span>${org.name}</span>
            `;
            dropdownList.appendChild(li);
        });
        // Get elements for Activity Logs
const viewActivityActive = document.getElementById('activity-active-state');
const viewActivityRestricted = document.getElementById('activity-restricted-state');

if (activeOrg.type === 'personal') {
    // ... existing hide logic for Dash/Members ...
    
    // NEW: Hide Activity elements
    if (viewActivityActive) viewActivityActive.style.display = 'none';
    if (viewActivityRestricted) viewActivityRestricted.style.display = 'block';
} else {
    // ... existing show logic for Dash/Members ...

    // NEW: Show Activity elements
    if (viewActivityActive) viewActivityActive.style.display = 'block';
    if (viewActivityRestricted) viewActivityRestricted.style.display = 'none';
}
    }
}

function initOrgSwitcher() {
    const switcherBtn = document.getElementById('orgSwitcherBtn');
    const dropdown = document.getElementById('orgDropdown');
    const dropdownList = document.getElementById('orgDropdownList');
    
    switcherBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
        switcherBtn.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (switcherBtn && dropdown && !switcherBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
            switcherBtn.classList.remove('active');
        }
    });

    document.getElementById('dropdown-create-org')?.addEventListener('click', () => {
        dropdown.classList.remove('show');
        document.getElementById('btn-create-org').click(); 
    });

    dropdownList?.addEventListener('click', async (e) => {
        const item = e.target.closest('.org-dropdown-item');
        if (!item) return;

        const selectedSlug = item.dataset.slug;
        if (selectedSlug && selectedSlug !== state.activeOrgSlug) {
            state.activeOrgSlug = selectedSlug;
            localStorage.setItem("active_org", selectedSlug);
            
            dropdown.classList.remove('show');
            switcherBtn.classList.remove('active');

            updateOrgSwitcherUI();
            await loadActiveOrgData(); // Fetch all data for the new org
        }
    });
}

// Shared logic for creating Workspaces / Kanban / Notes
function initCreationModals() {
    // 1. Generic Modal (Orgs / Workspaces)
    const genericModal = document.getElementById('creation-modal');
    const genericTitle = document.getElementById('modal-title');
    const genericInput = document.getElementById('modal-input');
    let creationType = null; 

    document.getElementById('btn-create-org')?.addEventListener('click', () => {
        creationType = 'org'; genericTitle.textContent = 'Create Organization';
        genericModal.style.display = 'flex'; genericInput.focus();
    });

    document.getElementById('btn-create-workspace')?.addEventListener('click', () => {
        creationType = 'workspace'; genericTitle.textContent = 'Create Workspace';
        genericModal.style.display = 'flex'; genericInput.focus();
    });
    
    document.getElementById('btn-create-workspace-page')?.addEventListener('click', () => {
        document.getElementById('btn-create-workspace').click();
    });

    document.getElementById('modal-cancel')?.addEventListener('click', () => {
        genericModal.style.display = 'none'; genericInput.value = '';
    });

    document.getElementById('modal-submit')?.addEventListener('click', async () => {
        const name = genericInput.value.trim();
        if(!name) return;

        try {
            if (creationType === 'org') {
                await postJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ORG_CREATE}`, { name, type: "team" }, authHeaders());
            } else {
                await postJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.WORKSPACE_CREATE}`, { name }, authHeaders({ "X-ORG-SLUG": state.activeOrgSlug }));
            }
            genericModal.style.display = 'none';
            genericInput.value = '';
            await loadData(); 
        } catch(e) { alert("Error creating " + creationType); }
    });

    // 2. Note Creation
    document.getElementById('btn-create-note')?.addEventListener('click', () => {
        const wsSelect = document.getElementById('note-workspace-select');
        wsSelect.innerHTML = '<option value="" disabled selected>Select a workspace...</option>';
        state.workspaces.forEach(ws => wsSelect.appendChild(new Option(ws.name, ws.slug)));
        
        document.getElementById('note-title-input').value = '';
        document.getElementById('note-content-input').value = '';
        document.getElementById('note-creation-modal').style.display = 'flex';
    });

    document.getElementById('btn-cancel-note')?.addEventListener('click', () => document.getElementById('note-creation-modal').style.display = 'none');

    document.getElementById('btn-submit-note')?.addEventListener('click', async (e) => {
        const btn = e.target;
        const slug = document.getElementById('note-workspace-select').value;
        const title = document.getElementById('note-title-input').value.trim();
        const content = document.getElementById('note-content-input').value.trim();

        if (!slug || !title || !content) return alert('Fill all fields.');
        
        btn.disabled = true; btn.textContent = 'Saving...';
        try {
            await postJSON(`${CONFIG.API_BASE}/notes/workspaces/${slug}/notes/`, { title, content }, authHeaders({ "X-ORG-SLUG": state.activeOrgSlug }));
            document.getElementById('note-creation-modal').style.display = 'none';
            await loadActiveOrgData(); // Refresh notes
        } catch (err) { alert('Failed to create note.'); }
        btn.disabled = false; btn.textContent = 'Save Note';
    });

    // 3. Kanban Creation
    document.getElementById('btn-create-kanban')?.addEventListener('click', () => {
        const wsSelect = document.getElementById('kanban-workspace-select');
        wsSelect.innerHTML = '<option value="" disabled selected>Select a workspace...</option>';
        state.workspaces.forEach(ws => wsSelect.appendChild(new Option(ws.name, ws.slug)));
        
        document.getElementById('kanban-name-input').value = '';
        document.getElementById('kanban-creation-modal').style.display = 'flex';
    });

    document.getElementById('btn-cancel-kanban')?.addEventListener('click', () => document.getElementById('kanban-creation-modal').style.display = 'none');

    document.getElementById('btn-submit-kanban')?.addEventListener('click', async (e) => {
        const btn = e.target;
        const slug = document.getElementById('kanban-workspace-select').value;
        const name = document.getElementById('kanban-name-input').value.trim();

        if (!slug || !name) return alert('Fill all fields.');
        
        btn.disabled = true; btn.textContent = 'Creating...';
        try {
            await postJSON(`${CONFIG.API_BASE}/board/workspaces/${slug}/boards/`, { name }, authHeaders({ "X-ORG-SLUG": state.activeOrgSlug }));
            document.getElementById('kanban-creation-modal').style.display = 'none';
            await loadActiveOrgData(); // Refresh kanbans
        } catch (err) { alert('Failed to create board.'); }
        btn.disabled = false; btn.textContent = 'Create Board';
    });
}

function initSearchAndFilters() {
    const bindSearch = (inputId, itemSelector, datasetKey = 'name') => {
        document.getElementById(inputId)?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll(itemSelector).forEach(el => {
                // If checking notes, check title AND content
                const matchVal = el.dataset[datasetKey] || "";
                const extraVal = el.dataset.content || "";
                el.style.display = (matchVal.includes(query) || extraVal.includes(query)) ? 'flex' : 'none';
            });
        });
    };

    bindSearch('workspaceSearchInput', '#all-workspaces-grid .workspace-card', 'name');
    bindSearch('noteSearchInput', '.note-card', 'title');
    bindSearch('kanbanSearchInput', '.kanban-card', 'name');
    bindSearch('memberSearchInput', '#members-list-body .member-row', 'name'); // Also handles email indirectly if added to dataset

    // Tasks specifically has status filter too
    const taskSearch = document.getElementById('taskSearchInput');
    const taskStatus = document.getElementById('taskStatusFilter');
    
    const applyTaskFilters = () => {
        const q = taskSearch?.value.toLowerCase() || "";
        const s = taskStatus?.value || "all";
        
        document.querySelectorAll('.task-row').forEach(row => {
            const matchQuery = row.dataset.title.includes(q);
            const matchStatus = s === 'all' || row.dataset.status === s;
            row.style.display = (matchQuery && matchStatus) ? 'flex' : 'none';
        });
    };
    taskSearch?.addEventListener('input', applyTaskFilters);
    taskStatus?.addEventListener('change', applyTaskFilters);
}

function initSettingsInteractions() {
    document.getElementById('btn-save-org-name')?.addEventListener('click', async (e) => {
        const newName = document.getElementById('setting-org-name').value.trim();
        const status = document.getElementById('org-name-status');
        if (!newName) return (status.textContent = "Cannot be empty.", status.style.color = "var(--error)");

        e.target.disabled = true; e.target.textContent = "Saving...";
        try {
            // Need a generic organization update endpoint
            await patchJSON(`${CONFIG.API_BASE}/organization/update/`, { name: newName }, authHeaders({ "X-ORG-SLUG": state.activeOrgSlug }));
            status.textContent = "Saved!"; status.style.color = "var(--success)";
            await loadData(); // Reload to reflect changes
        } catch (err) { status.textContent = "Failed to save."; status.style.color = "var(--error)"; }
        
        e.target.disabled = false; e.target.textContent = "Save Changes";
        setTimeout(() => status.textContent = "", 3000);
    });

    document.getElementById('btn-update-pwd')?.addEventListener('click', async (e) => {
        const current = document.getElementById('setting-current-pwd').value;
        const newPwd = document.getElementById('setting-new-pwd').value;
        const status = document.getElementById('pwd-status');

        if (!current || !newPwd) return (status.textContent = "Fill all fields.", status.style.color = "var(--error)");

        e.target.disabled = true; e.target.textContent = "Updating...";
        try {
            await postJSON(`${CONFIG.API_BASE}/auth/password-reset/`, { current_password: current, new_password: newPwd }, authHeaders());
            status.textContent = "Password updated!"; status.style.color = "var(--success)";
            document.getElementById('setting-current-pwd').value = '';
            document.getElementById('setting-new-pwd').value = '';
            document.getElementById('setting-confirm-pwd').value = '';
        } catch (err) { status.textContent = "Failed to update."; status.style.color = "var(--error)"; }
        
        e.target.disabled = false; e.target.textContent = "Update Password";
        setTimeout(() => status.textContent = "", 3000);
    });

    document.getElementById('btn-delete-org')?.addEventListener('click', async (e) => {
        const activeOrg = state.organizations.find(o => o.slug === state.activeOrgSlug);
        if (!activeOrg) return;

        if (prompt(`Type '${activeOrg.name}' to delete:`) === activeOrg.name) {
            e.target.disabled = true; e.target.textContent = "Deleting...";
            try {
                await deleteJSON(`${CONFIG.API_BASE}/organization/delete/${activeOrg.id}/`, authHeaders({ "X-ORG-SLUG": state.activeOrgSlug }));
                alert('Organization deleted.');
                localStorage.removeItem("active_org");
                window.location.reload(); 
            } catch (err) { 
                alert("Failed to delete organization."); 
                e.target.disabled = false; e.target.textContent = "Delete Organization";
            }
        }
    });
}

function initMiscInteractions() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.querySelector('.toggle-sidebar-btn');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }
    // Task Modal Close
    document.getElementById('btn-close-task-detail')?.addEventListener('click', () => document.getElementById('task-detail-modal').style.display = 'none');
    document.getElementById('task-detail-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.target.style.display = 'none';
    });

    // Member Invite
    const inviteModal = document.getElementById('invite-modal');
    document.getElementById('btn-invite-member')?.addEventListener('click', () => inviteModal.style.display = 'flex');
    document.getElementById('btn-cancel-invite')?.addEventListener('click', () => inviteModal.style.display = 'none');
    
    document.getElementById('btn-send-invite')?.addEventListener('click', async (e) => {
        const email = document.getElementById('invite-email-input').value;
        const role = document.getElementById('invite-role-input').value;
        if (!email) return alert("Enter an email.");
        
        e.target.disabled = true; e.target.textContent = "Sending...";
        try {
            await postJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.MEMBER_INVITE}`, { email, role }, authHeaders({ "X-ORG-SLUG": state.activeOrgSlug }));
            alert(`Invite sent to ${email}`);
            inviteModal.style.display = 'none';
            document.getElementById('invite-email-input').value = '';
        } catch (err) { alert("Failed to send invite."); }
        e.target.disabled = false; e.target.textContent = "Send Invite";
    });

    // Mobile Sidebar Toggle
    document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('open');
    });
}
// ==================== SESSION MANAGEMENT ====================
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refresh");
    
    if (!refreshToken) {
        console.warn("No refresh token found.");
        forceLogout();
        return false;
    }

    try {
        const response = await fetch(`${CONFIG.API_BASE}/auth/refresh/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ refresh: refreshToken })
        });

        // If the refresh token itself is expired or invalid
        if (!response.ok) {
            throw new Error("Invalid refresh token.");
        }

        const data = await response.json();
        
        // Save new tokens to local storage immediately
        if (data.access) localStorage.setItem("access", data.access);
        if (data.refresh) localStorage.setItem("refresh", data.refresh); 

        console.log("Session refreshed successfully.");
        return true;

    } catch (error) {
        console.error("Token refresh failed:", error);
        forceLogout();
        return false;
    }
}

function forceLogout() {
    // Clear all auth data and redirect to login page
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    
    // Optional: Keep workspace/org settings in localStorage so they remember where they were, 
    // or run localStorage.clear() to wipe everything.
    
    window.location.href = "login.html"; 
}
function initTokenAutoRefresh() {
    const EIGHT_MINUTES = 8 * 60 * 1000; // 8 minutes in milliseconds
    
    // Run the refresh interval
    setInterval(refreshAccessToken, EIGHT_MINUTES);
}
function initBillingInteractions() {
    const errorBox = document.getElementById("billing-error-box");
    const paymentModal = document.getElementById("payment-modal");
    const btnCancelPayment = document.getElementById("btn-cancel-payment");
    const btnConfirmPayment = document.getElementById("btn-confirm-payment");

    // 1. Listen for Plan Selection clicks
    document.querySelectorAll(".plan-btn").forEach(button => {
        button.addEventListener("click", async (e) => {
            errorBox.textContent = "";
            const planTitle = e.target.dataset.plan; // "basic", "standard", "premium"
            
            if (!planTitle) return;

            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = "Processing...";

            try {
                const headers = authHeaders({ "X-ORG-SLUG": state.activeOrgSlug });
                let payload;

                // Logic: POST if currently on free/basic plan. PUT if upgrading/downgrading from paid.
                if (state.currentPlan === 'basic' || state.currentPlan === 'free') {
                    // Sending POST Request
                    payload = await postJSON(
                        `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.SUBSCRIPTION}`, 
                        { title: planTitle }, 
                        headers
                    );
                } else {
                    // Sending PUT Request
                    payload = await postJSON(
                        `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.SUBSCRIPTION}`, 
                        { title: planTitle }, 
                        headers
                    );
                }

                // If the backend indicates it's a free downgrade, it might not return a PayU URL
                if (!payload || !payload.payu_url) {
                    alert(`Successfully changed plan to ${planTitle}.`);
                    await loadBillingData(); // Reload UI
                    return;
                }

                // If PayU URL exists, prep the modal
                state.pendingPaymentPayload = payload;
                paymentModal.style.display = "flex";

            } catch (error) {
                console.error("Payment Initiation Error:", error);
                errorBox.textContent = error.message || "Failed to initiate payment. Please try again.";
            } finally {
                // Reset button if modal wasn't opened
                if (paymentModal.style.display !== "flex") {
                    button.disabled = false;
                    button.textContent = originalText;
                }
            }
        });
    });

    // 2. Handle Modal Confirmation (Redirect to PayU)
    btnConfirmPayment?.addEventListener("click", () => {
        if (!state.pendingPaymentPayload || !state.pendingPaymentPayload.payu_url) return;

        btnConfirmPayment.disabled = true;
        btnConfirmPayment.textContent = "Redirecting...";

        // Create an invisible form to submit the payload to PayU
        const form = document.createElement("form");
        form.method = "POST";
        form.action = state.pendingPaymentPayload.payu_url;

        Object.keys(state.pendingPaymentPayload).forEach(key => {
            if (key === "payu_url") return; // Don't append the URL as an input
            
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = state.pendingPaymentPayload[key];
            form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
    });

    // 3. Handle Modal Cancel
    btnCancelPayment?.addEventListener("click", () => {
        paymentModal.style.display = "none";
        state.pendingPaymentPayload = null;
        loadBillingData(); // Reset buttons
    });
}
// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Immediately refresh token on page load
    const isValidSession = await refreshAccessToken();
    if (!isValidSession) return; // Stop execution if session is invalid (forceLogout takes over)

    // 2. Initialize UI Components
    initRouter();
    initOrgSwitcher();
    initCreationModals();
    initSearchAndFilters();
    initSettingsInteractions();
    initMiscInteractions();
    initBillingInteractions();
    initTopbarAndSSE();
    initHeartbeat();
    
    // 3. Set background auto-refresh interval (every 8 minutes)
    setInterval(refreshAccessToken, 8 * 60 * 1000);

    // 4. Finally, fetch the real dashboard data securely
    loadData();
});
// ==================== TOPBAR UI & SSE NOTIFICATIONS ====================

let sseConnection = null;

function initTopbarAndSSE() {
    // --- 1. DROPDOWN UI TOGGLES ---
    const notifBtn = document.getElementById('notification-btn');
    const notifDropdown = document.getElementById('notification-dropdown');
    
    const userBtn = document.getElementById('user-profile-btn');
    const userDropdown = document.getElementById('user-dropdown');

    // Toggle Notifications
    notifBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.style.display = notifDropdown.style.display === 'flex' ? 'none' : 'flex';
        userDropdown.style.display = 'none'; // Close the other
    });

    // Toggle User Profile
    userBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
        notifDropdown.style.display = 'none'; // Close the other
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (notifDropdown && !notifDropdown.contains(e.target)) notifDropdown.style.display = 'none';
        if (userDropdown && !userDropdown.contains(e.target)) userDropdown.style.display = 'none';
    });

    // Logout Action
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        if(confirm("Are you sure you want to log out?")) {
            forceLogout();
        }
    });

    // --- 2. SERVER-SENT EVENTS (SSE) CONNECTION ---
    const token = localStorage.getItem("access");
    if (!token) return;

    // NOTE: EventSource does not support Headers. Pass the token in the URL.
    // Adjust this URL to match your actual Django SSE endpoint
    const sseEndpoint = `${CONFIG.API_BASE}/notification/?token=${token}`; 

    if (sseConnection) sseConnection.close();
    sseConnection = new EventSource(sseEndpoint);

    sseConnection.onopen = () => {
        console.log("SSE Notifications Connected.");
    };

    sseConnection.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleIncomingNotification(data);
        } catch (e) {
            console.error("Failed to parse SSE event data:", e);
        }
    };

    sseConnection.onerror = (err) => {
        console.error("SSE Connection Error. Attempting to reconnect...", err);
        // The browser automatically tries to reconnect EventSource objects!
    };
}

// --- 3. HANDLE INCOMING DATA ---
function handleIncomingNotification(data) {
    const badge = document.getElementById('notification-count');
    const list = document.getElementById('notification-list');
    const emptyState = list.querySelector('.empty-notif-state');

    // Remove empty state text
    if (emptyState) emptyState.remove();

    // Increment Badge
    let currentCount = parseInt(badge.textContent || "0");
    badge.textContent = currentCount + 1;
    badge.style.display = 'flex';

    // Create Notification Item
    const li = document.createElement('li');
    li.className = 'notification-item unread';
    
    // Choose an icon based on the type of notification
    let icon = '🔔';
    if (data.type === 'task') icon = '☑';
    if (data.type === 'mention') icon = '💬';

    li.innerHTML = `
        <div style="font-size: 18px;">${icon}</div>
        <div style="flex: 1;">
            <div style="font-size: 13px; color: var(--text-primary); margin-bottom: 4px; line-height: 1.4;">
                ${data.message || 'You have a new notification.'}
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">${new Date().toLocaleTimeString()}</div>
        </div>
    `;

    // Mark as read on click
    li.addEventListener('click', async () => {
        if (!li.classList.contains('unread')) return;

        li.classList.remove('unread');
        
        let count = parseInt(badge.textContent || "0");
        if (count > 0) {
            badge.textContent = count - 1;
            if (count - 1 === 0) badge.style.display = 'none';
        }

        // Send REST request to update the read status in the backend
        if (data.id) {
            try {
                // Adjust this endpoint based on your backend
                await fetchJSON(`${CONFIG.API_BASE}/notification/update/`, authHeaders());
            } catch (e) { console.error("Failed to mark read", e); }
        }
    });

    // Add to top of list
    list.prepend(li);
}
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