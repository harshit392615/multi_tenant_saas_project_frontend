console.log("ORG DASHBOARD JS LOADED");
console.log(localStorage.getItem("current_org_id"))
// ==================== CONFIG ====================
const CONFIG = {
    API_BASE: "https://multi-tenant-saas-project.onrender.com/api",
    ENDPOINTS: {
    WORKSPACES: "/workspace/",
    MEMBERS: "/organization/membership/",
    LOGS: "/activities/activities/",
    ADD_MEMBER: "/organization/membership/",
    UPDATE_MEMBER: "/organization/membership/update/",
    DELETE_ORG: "/organization/delete/"
}

};

// ==================== STATE ====================
const state = {
    orgSlug: null,
    workspaces: [],
    members: [],
    logs: [],
    loading: false
};

// ==================== API HELPERS ====================
async function refreshAccessToken() {
    const refresh = localStorage.getItem("refresh");
    if (!refresh) throw new Error("No refresh token");

    const res = await fetch(`${CONFIG.API_BASE}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh })
    });

    if (!res.ok) {
        localStorage.clear();
        throw new Error("Session expired");
    }

    const data = await res.json();
    localStorage.setItem("access", data.access);
    if (data.refresh) localStorage.setItem("refresh", data.refresh);

    return data.access;
}

async function fetchJSON(url, headers = {}) {
    let res = await fetch(url, { headers });

    if (res.status === 401) {
        const newAccess = await refreshAccessToken();
        res = await fetch(url, { headers: { ...headers, Authorization: `Bearer ${newAccess}` } });
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function postJSON(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders({ "X-ORG-SLUG": state.orgSlug }) },
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function authHeaders(extra = {}) {
    const token = localStorage.getItem("access");
    return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
}

// ==================== INIT ====================
async function initOrgDashboard() {
    state.orgSlug = localStorage.getItem("current_org");
    if (!state.orgSlug) return console.error("No current_org set");

    setLoading(true);
    try {
        await Promise.all([loadWorkspaces(), loadMembers(), loadLogs()]);
        renderWorkspaces();
        renderMembers();
        renderLogs();
    } catch (err) {
        console.error("Org dashboard load failed:", err);
    } finally {
        setLoading(false);
    }
}

// ==================== DATA LOADERS ====================
async function loadWorkspaces() {
    const res = await fetch(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.WORKSPACES}`, {
        headers: authHeaders({ "X-ORG-SLUG": state.orgSlug })
    });
    state.workspaces = await res.json();
}

async function loadMembers() {
    state.members = await fetchJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.MEMBERS}`, authHeaders({ "X-ORG-SLUG": state.orgSlug }));
}

async function loadLogs() {
    state.logs = await fetchJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LOGS}`, authHeaders({ "X-ORG-SLUG": state.orgSlug }));
}

// ==================== RENDERERS ====================
function renderWorkspaces() {
    const container = document.getElementById("workspace_container");
    if (!container) return;
    container.innerHTML = "";

    state.workspaces.forEach(ws => {
        const li = document.createElement("li");
        li.textContent = ws.name;
        li.dataset.slug = ws.slug;
        li.dataset.id = ws.id;
        li.addEventListener("click", () => {
            localStorage.setItem("current_workspace", ws.slug);
            localStorage.setItem("current_workspace_id", ws.id);
            window.location.href = "../html/workspace.html";
        });
        container.appendChild(li);
    });
}

function renderMembers() {
    const tbody = document.getElementById("users-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    state.members.forEach(user => {
        const isOnline = user.status === 1;
        const statusText = isOnline ? "Online" : "Offline";
        const statusClass = isOnline ? "online" : "offline";

        const tr = document.createElement("tr");
        tr.dataset.userId = user.id;
        tr.dataset.email = user.email;
        tr.dataset.role = user.role;

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="avatar-sm" style="background:#3b82f6;">
                        ${user.username.charAt(0).toUpperCase()}
                    </div>
                    <span>${user.username}</span>
                </div>
            </td>
            <td class="muted-text">${user.email}</td>
            <td class="role-cell">
                <span class="role-badge ${user.role}">
                    ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
            </td>
            <td>
                <span class="status-dot ${statusClass}"></span> ${statusText}
            </td>
        `;

        tr.querySelector(".role-cell").addEventListener("click", e => {
            console.log("ROLE CELL CLICKED");
            e.stopPropagation();
            enableRoleEdit(tr);
        });

        tbody.appendChild(tr);
    });
}
async function enableRoleEdit(row) {
    const roleCell = row.querySelector(".role-cell");
    if (roleCell.querySelector("select")) return;

    const email = row.dataset.email;
    const currentRole = row.dataset.role;

    roleCell.innerHTML = `
    <select class="role-select">
        <option value="viewer">Viewer</option>
        <option value="member">Member</option>
        <option value="admin">Admin</option>
    </select>
`;

    const select = roleCell.querySelector("select");
    select.value = currentRole;
    select.focus();

    const cancel = () => renderMembers();

    select.addEventListener("keydown", e => {
        if (e.key === "Escape") cancel();
    });

    select.addEventListener("blur", cancel);

    select.addEventListener("change", async () => {
        const newRole = select.value;
        try {
            await postJSON(
                `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.UPDATE_MEMBER}`,
                { email, role: newRole }
            );

            const member = state.members.find(m => m.email === email);
            if (member) member.role = newRole;

            renderMembers();
        } catch (err) {
            console.error("Role update failed:", err);
            alert("Failed to update role");
            renderMembers();
        }
    });
}

function setupSubscriptionNavigation() {
    const btn = document.getElementById("subscription-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
        window.location.href = "../html/subscription.html";
    });
}
function setupDeleteOrganization() {
    const btn = document.getElementById("delete-org-btn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
        const orgId = localStorage.getItem("current_org_id"); 
        // Make sure you store this when org is selected

        if (!orgId) {
            alert("Organization ID not found");
            return;
        }

        const confirmDelete = confirm(
            "Are you sure you want to permanently delete this organization?\n\nThis action cannot be undone."
        );

        if (!confirmDelete) return;

        btn.disabled = true;

        try {
            const res = await fetch(
                `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.DELETE_ORG}${orgId}`,
                {
                    method: "DELETE",
                    headers: authHeaders({ "X-ORG-SLUG": state.orgSlug })
                }
            );

            if (!res.ok) throw new Error("Delete failed");

            // Clear local storage
            localStorage.removeItem("current_org");
            localStorage.removeItem("current_org_id");

            alert("Organization deleted successfully");

            // Redirect to org selection or dashboard
            window.location.href = "../html/dashboard.html";

        } catch (err) {
            console.error("Delete org failed:", err);
            alert("Failed to delete organization");
        } finally {
            btn.disabled = false;
        }
    });
}

function setupThemeToggle() {
    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;

    const savedTheme = localStorage.getItem("theme") || "dark";
    document.body.setAttribute("data-theme", savedTheme);

    toggle.addEventListener("click", () => {
        const currentTheme = document.body.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";

        document.body.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    });
}

function setupSidebarNavigation() {
    const items = document.querySelectorAll(".nav-item[data-route]");

    items.forEach(item => {
        item.addEventListener("click", e => {
            e.preventDefault();

            document.querySelectorAll(".nav-item")
                .forEach(i => i.classList.remove("active"));

            item.classList.add("active");

            const route = item.dataset.route;

            const map = {
                overview: "overview-section",
                members: "members-section",
                workspaces: "overview-section",
                logs: "logs-section"
            };

            const section = document.getElementById(map[route]);
            if (section) {
                section.scrollIntoView({ behavior: "smooth" });
            }
        });
    });
}




// Update member online/offline status live
async function updateMemberStatus() {
    try {
        const membersStatus = await fetchJSON(`${CONFIG.API_BASE}/auth/activity/status/?id_token=${localStorage.getItem("access")}`);
        membersStatus.forEach(user => {
            const tr = document.querySelector(`tr[data-user-id='${user.id}']`);
            if (!tr) return;

            const statusCell = tr.querySelector("td:last-child");
            const isOnline = user.status === 1;
            const statusText = isOnline ? "Online" : "Offline";
            const statusClass = isOnline ? "online" : "offline";

            statusCell.innerHTML = `<span class="status-dot ${statusClass}"></span> ${statusText}`;
        });
    } catch (err) {
        console.error("Failed to update member status:", err);
    }
}

function renderLogs() {
    const container = document.getElementById("activity-feed");
    if (!container) return;
    container.innerHTML = "";

    state.logs.forEach(log => {
        const li = document.createElement("li");
        li.innerHTML = `<p>${log.action}</p><span>${log.created_at}</span>`;
        container.appendChild(li);
    });
}

// ==================== CREATE WORKSPACE ====================
function setupCreateWorkspace() {
    const createBtn = document.getElementById("create-workspace-btn");
    const modal = document.getElementById("create-workspace-modal");
    const submitBtn = document.getElementById("create-workspace-submit");
    const cancelBtn = document.getElementById("create-workspace-cancel");
    const nameInput = document.getElementById("workspace-name-input");

    if (!createBtn || !modal) return;

    createBtn.addEventListener("click", () => {
        modal.style.display = "block";
        nameInput.value = "";
        nameInput.focus();
    });

    cancelBtn.addEventListener("click", () => modal.style.display = "none");

    submitBtn.addEventListener("click", async () => {
        const name = nameInput.value.trim();
        if (!name) return alert("Workspace name required");

        submitBtn.disabled = true;
        try {
            await postJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.WORKSPACES}`, { name });
            await loadWorkspaces();
            renderWorkspaces();
            modal.style.display = "none";
        } catch (err) {
            console.error("Create workspace failed:", err);
            alert("Failed to create workspace");
        } finally {
            submitBtn.disabled = false;
        }
    });
}

// ==================== ADD MEMBER ====================
function setupAddMember() {
    const btn = document.getElementById("add-member-btn");
    const modal = document.getElementById("add-member-modal");
    const cancel = document.getElementById("add-member-cancel");
    const submit = document.getElementById("add-member-submit");
    const emailInput = document.getElementById("member-email-input");
    const roleInput = document.getElementById("member-role-input");

    if (!btn || !modal) return;

    btn.addEventListener("click", () => {
        modal.style.display = "block";
        emailInput.value = "";
        roleInput.value = "member";
        emailInput.focus();
    });

    cancel.addEventListener("click", () => modal.style.display = "none");
    modal.addEventListener("click", e => { if (e.target === modal) modal.style.display = "none"; });

    submit.addEventListener("click", async () => {
        const email = emailInput.value.trim();
        const role = roleInput.value;
        if (!email) return alert("Email required");

        submit.disabled = true;
        try {
            await postJSON(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ADD_MEMBER}`, { email, role });
            await loadMembers();
            renderMembers();
            modal.style.display = "none";
        } catch (err) {
            console.error("Add member failed:", err);
            alert("Failed to add member");
        } finally {
            submit.disabled = false;
        }
    });
}

// ==================== UI STATE ====================
function setLoading(isLoading) {
    state.loading = isLoading;
    document.body.classList.toggle("loading", isLoading);
}

// ==================== SSE HEARTBEAT ====================
function startSSEHeartbeat() {
    const idToken = localStorage.getItem("access");
    if (!idToken) return console.error("No id_token found");

    const evtSource = new EventSource(`${CONFIG.API_BASE}/auth/activity/status/?token=${idToken}`);

    evtSource.addEventListener("heartbeat", event => {
        console.log("Heartbeat received:", event.data);
        updateMemberStatus(); // refresh online status live
    });

    evtSource.onerror = err => {
        console.error("SSE connection error", err);
        evtSource.close();
        setTimeout(startSSEHeartbeat, 5000); // retry
    };
}

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", () => {
    startSSEHeartbeat();
    initOrgDashboard();
    setupCreateWorkspace();
    setupAddMember();
    setupSubscriptionNavigation();
    setupDeleteOrganization();
    setupThemeToggle();
    setupSidebarNavigation();


});

document.querySelectorAll(".modal-overlay").forEach(modal => {
    modal.addEventListener("click", e => {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });
});