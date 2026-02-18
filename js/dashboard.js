console.count("dashboard.js loaded");

// ==================== CONFIG ====================
// ==================== CONFIG ====================

const CONFIG = {
    API_BASE: "http://127.0.0.1:8000/api",
    ENDPOINTS: {
        ORG_LIST: "/organization/list/",
        ORG_CREATE: "/organization/create/",
        WORKSPACE_LIST: "/workspace/",
        WORKSPACE_CREATE: "/workspace/"
    }
};

// ==================== GLOBAL STATE ====================
const state = {
    organizations: [],
    personalOrg: null,
    teamOrgs: [],
    workspaces: [],
    workspacesByOrg: {},
    activeOrgSlug: null,
    searchQuery: ""
};

// ==================== API HELPERS ====================
async function fetchJSON(url, headers = {}) {
    let res = await fetch(url, { headers });

    if (res.status === 401) {
        console.log("see this")
        const refresh = localStorage.getItem("refresh");
        if (!refresh) {
            localStorage.clear();
            throw new Error("No refresh token");
        }

        const refreshRes = await fetch(
            "http://192.168.1.2:8000/api/auth/refresh/",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ refresh }),
            }
        );

        if (!refreshRes.ok) {
            localStorage.clear();
            throw new Error("Session expired");
        }

        const data = await refreshRes.json();
        localStorage.setItem("access", data.access);
        if (data.refresh) {
            localStorage.setItem("refresh", data.refresh);
        }

        // retry original request with new access token
        res = await fetch(url, {
            headers: {
                ...headers,
                Authorization: `Bearer ${data.access}`,
            },
        });
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}


async function postJSON(url, body, headers = {}) {
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...headers
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function authHeaders(extra = {}) {
    const token = localStorage.getItem("access");
    return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
}

// ==================== DOM HELPERS ====================
function el(tag, text, className) {
    const e = document.createElement(tag);
    if (text) e.textContent = text;
    if (className) e.className = className;
    return e;
}

function clear(node) {
    if (node) node.innerHTML = "";
}

function createCard({ name, slug , id}, type) {
    const card = el("article", null, `card ${type}-card`);
    card.dataset.slug = slug;
    card.dataset.id = id;
    card.append(
        el("h3", name),
        el("button", "Open", "btn-ghost")
    );
    return card;
}

// ==================== DATA LOADING ====================
async function loadOrganizations() {
    const orgs = await fetchJSON(
        `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ORG_LIST}`,
        authHeaders()
    );

    state.organizations = orgs;
    state.personalOrg = orgs.find(o => o.type === "personal") || null;
    state.teamOrgs = orgs.filter(o => o.type !== "personal");

    const stored = localStorage.getItem("active_org");
    state.activeOrgSlug =
        stored && orgs.some(o => o.slug === stored)
            ? stored
            : state.personalOrg?.slug ||
              state.teamOrgs[0]?.slug ||
              null;

    if (state.activeOrgSlug) {
        localStorage.setItem("active_org", state.activeOrgSlug);
    }
}

async function loadWorkspaces() {
    if (!state.activeOrgSlug) return;

    const list = await fetchJSON(
        `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.WORKSPACE_LIST}`,
        authHeaders({ "X-ORG-SLUG": state.activeOrgSlug })
    );

    state.workspaces = list;
    state.workspacesByOrg = {
        [state.activeOrgSlug]: list
    };
}

// ==================== RENDER ====================
function renderOrganizations() {
    const sidebar = document.getElementById("orgs-list");
    const grid = document.getElementById("orgs-grid");

    clear(sidebar);
    clear(grid);

    state.teamOrgs.forEach(org => {
        const li = el("li", org.name);
        li.dataset.slug = org.slug;
        li.dataset.id = org.id;
        sidebar.appendChild(li);

        grid.appendChild(createCard(org, "org"));
    });
}

function renderWorkspaces() {
    const sidebar = document.getElementById("projects-list");
    const grid = document.getElementById("projects-grid");

    clear(sidebar);
    clear(grid);

    const list = state.workspacesByOrg[state.activeOrgSlug] || [];

    list.forEach(ws => {
        const li = el("li", ws.name);
        li.dataset.slug = ws.slug;
        sidebar.appendChild(li);

        grid.appendChild(createCard(ws, "workspace"));
    });
}

// ==================== SEARCH ====================
function applySearch() {
    const q = state.searchQuery.toLowerCase();
    const match = txt => txt.toLowerCase().includes(q);

    document.querySelectorAll(".card").forEach(card => {
        const title = card.querySelector("h3")?.textContent || "";
        card.style.display = match(title) ? "" : "none";
    });

    document.querySelectorAll("#orgs-list li, #projects-list li").forEach(li => {
        li.style.display = match(li.textContent) ? "" : "none";
    });
}

// ==================== INIT ====================
async function initDashboard() {
    await loadOrganizations();
    renderOrganizations();

    await loadWorkspaces();
    renderWorkspaces();
}

// ==================== EVENTS ====================
document.addEventListener("DOMContentLoaded", () => {
    console.count("DOMContentLoaded fired");

    initDashboard();

    // SEARCH
    let timer;
    document.querySelectorAll(".search-bar input").forEach(input => {
        input.addEventListener("input", e => {
            clearTimeout(timer);
            state.searchQuery = e.target.value;
            timer = setTimeout(applySearch, 300);
        });
    });

    // SIDEBAR ORG SWITCH
    document.getElementById("orgs-list")?.addEventListener("click", async e => {
        if (e.target.tagName !== "LI") return;

        state.activeOrgSlug = e.target.dataset.slug;
        state.activeOrgid = e.target.dataset.id;
        localStorage.setItem("active_org", state.activeOrgSlug);
        localStorage.setItem("active_org_id", state.activeOrgid);
        console.log()

        await loadWorkspaces();
        renderWorkspaces();
    });

    // ORG GRID NAVIGATION
    document.getElementById("orgs-grid")?.addEventListener("click", e => {
        const card = e.target.closest(".card");
        if (!card) return;

        localStorage.setItem("current_org", card.dataset.slug);
        localStorage.setItem("current_org_id", card.dataset.id);
        console.log(localStorage.getItem("current_org_id"));
        window.location.href = "../html/org_dashboard.html";
    });

    // WORKSPACE NAVIGATION
    document.getElementById("projects-grid")?.addEventListener("click", e => {
        const card = e.target.closest(".card");
        if (!card) return;

        localStorage.setItem("current_workspace", card.dataset.slug);
        window.location.href = "../html/workspace.html";
    });

    // CREATE ORG
    document.getElementById("submitOrg")?.addEventListener("click", async () => {
        const input = document.getElementById("orgNameInput");
        const name = input.value.trim();
        if (!name) return;

        await postJSON(
            `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ORG_CREATE}`,
            { name, type: "team" },
            authHeaders()
        );

        input.value = "";
        await initDashboard();
    });

    // CREATE WORKSPACE
    document.getElementById("submitWorkspace")?.addEventListener("click", async () => {
        const input = document.getElementById("workspaceNameInput");
        const name = input.value.trim();
        if (!name || !state.activeOrgSlug) return;

        await postJSON(
            `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.WORKSPACE_CREATE}`,
            { name },
            authHeaders({ "X-ORG-SLUG": state.activeOrgSlug })
        );

        input.value = "";
        await loadWorkspaces();
        renderWorkspaces();

    });
    // ==================== NOTIFICATIONS SSE ====================

const notificationBtn = document.getElementById("notification-btn");
const notificationDropdown = document.getElementById("notification-dropdown");
const notificationCount = document.getElementById("notification-count");

let unreadCount = 0;
let dropdownOpen = false;

// Toggle dropdown on click
notificationBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    dropdownOpen = !dropdownOpen;
    notificationDropdown.style.display = dropdownOpen ? "block" : "none";

    // If closing the dropdown, mark notifications as read
    if (!dropdownOpen) {
        const token = localStorage.getItem("access");
        if (token) {
            try {
                const res = await fetch(`${CONFIG.API_BASE}/notification/update/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ mark_read: true }) // optional payload
                });

                if (!res.ok) console.error("Failed to update notifications:", res.status);
                else console.log("Notifications marked as read");

                // Reset unread count locally
                unreadCount = 0;
                notificationCount.textContent = unreadCount;
            } catch (err) {
                console.error("Error calling notification update API:", err);
            }
        }
    }
});

// Close dropdown if clicked outside
document.addEventListener("click", (e) => {
    if (!notificationBtn.contains(e.target) && !notificationDropdown.contains(e.target) && dropdownOpen) {
        dropdownOpen = false;
        notificationDropdown.style.display = "none";

        // Call API to mark read when closing
        const token = localStorage.getItem("access");
        if (token) {
            fetch(`${CONFIG.API_BASE}/notification/update/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ mark_read: true })
            }).then(res => {
                if (!res.ok) console.error("Failed to update notifications:", res.status);
                else console.log("Notifications marked as read");
                unreadCount = 0;
                notificationCount.textContent = unreadCount;
            }).catch(err => console.error(err));
        }
    }
});

// Function to add a notification
function addNotification(title, description) {
    const card = document.createElement("div");
    card.className = "notification-card";
    card.innerHTML = `<h4>${title}</h4><p>${description}</p>`;

    notificationDropdown.prepend(card);

    if (!dropdownOpen) {
        unreadCount += 1;
        notificationCount.textContent = unreadCount;
    }
}
    function initNotifications() {
    const token = localStorage.getItem("access");
    if (!token) return;

    const eventSource = new EventSource(`${CONFIG.API_BASE}/notification/?token=${token}`);

    eventSource.onmessage = function(event) {
    try {
        const data = JSON.parse(event.data);
        const title = data.title || "No Title";
        const description = data.description || "No Description";

        addNotification(title, description); // call our new function
    } catch (err) {
        console.error("Invalid notification data:", event.data);
    }
};


    eventSource.onerror = function(err) {
        console.error("SSE connection error:", err);
        eventSource.close();
        setTimeout(initNotifications, 5000);
    };
}

initNotifications();

// ================= THEME TOGGLE =================

const themeToggle = document.getElementById("theme-toggle");

// Load saved theme
const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
}

themeToggle?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");

    if (current === "dark") {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
    } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
    }
});


});