let pendingPayload = null;

function redirectToPayment(payload) {
    const errorBox = document.getElementById("errorBox");

    if (!payload || !payload.payu_url) {
        if (errorBox) errorBox.textContent = "Invalid payment session.";
        return;
    }

    pendingPayload = payload;

    const modal = document.getElementById("paymentModal");
    const planText = document.getElementById("selectedPlanText");

    if (planText) {
        planText.textContent = "You are subscribing to the selected plan.";
    }

    if (modal) {
        modal.style.display = "flex";
    }
}

document.addEventListener("DOMContentLoaded", () => {

    const API_URL = "https://multi-tenant-saas-project.onrender.com/api/organization/subscription/";
    const CURRENT_PLAN_URL = "https://multi-tenant-saas-project.onrender.com/api/organization/current-subscription/";

    const errorBox = document.getElementById("errorBox");

    /* =========================
       THEME TOGGLE
    ========================== */

    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = document.getElementById("themeIcon");
    const html = document.documentElement;

    function applyTheme(theme) {
        html.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
        if (themeIcon) {
            themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
        }
    }

    const savedTheme = localStorage.getItem("theme") || "light";
    applyTheme(savedTheme);

    themeToggle?.addEventListener("click", () => {
        const newTheme =
            html.getAttribute("data-theme") === "light" ? "dark" : "light";
        applyTheme(newTheme);
    });

    /* =========================
       LOAD CURRENT PLAN
    ========================== */

    async function loadCurrentPlan() {
        try {
            const token = localStorage.getItem("access");
            const orgSlug = localStorage.getItem("current_org");

            if (!token || !orgSlug) return;

            const res = await fetch(CURRENT_PLAN_URL, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "X-ORG-SLUG": orgSlug
                }
            });

            if (!res.ok) return;

            const data = await res.json();
            const currentPlan = data.plan;

            if (!currentPlan) return;

            const badge = document.getElementById(`current-${currentPlan}`);
            if (badge) {
                badge.textContent = "Current Plan";
                badge.style.display = "block";
            }

        } catch (err) {
            console.error("Failed to load current plan:", err);
        }
    }

    loadCurrentPlan();

    /* =========================
       PLAN SELECTION
    ========================== */

    document.querySelectorAll(".select-plan").forEach(button => {

        button.addEventListener("click", async (e) => {

            if (errorBox) errorBox.textContent = "";

            const card = e.target.closest(".pricing-card");
            const title = card?.dataset.plan;

            const token = localStorage.getItem("access");
            const orgSlug = localStorage.getItem("current_org");

            if (!token || !orgSlug) {
                if (errorBox) errorBox.textContent = "Authentication required.";
                return;
            }

            if (!title) {
                if (errorBox) errorBox.textContent = "Invalid plan selected.";
                return;
            }

            try {
                button.disabled = true;
                button.textContent = "Processing...";

                const response = await fetch(API_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                        "X-ORG-SLUG": orgSlug
                    },
                    body: JSON.stringify({ title })
                });

                if (!response.ok) {
                    throw new Error("Failed to initiate payment.");
                }

                const payload = await response.json();

                redirectToPayment(payload);

            } catch (error) {
                if (errorBox) errorBox.textContent = error.message;
                button.disabled = false;
                button.textContent = "Select Plan";
            }
        });
    });

    /* =========================
       MODAL ACTIONS
    ========================== */

    const confirmBtn = document.getElementById("confirmPaymentBtn");
    const cancelBtn = document.getElementById("cancelPaymentBtn");
    const modal = document.getElementById("paymentModal");

    confirmBtn?.addEventListener("click", () => {

        if (!pendingPayload) return;

        const form = document.createElement("form");
        form.method = "POST";
        form.action = pendingPayload.payu_url;

        Object.keys(pendingPayload).forEach(key => {
            if (key === "payu_url") return;

            const input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = pendingPayload[key];
            form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
    });

    cancelBtn?.addEventListener("click", () => {
        if (modal) modal.style.display = "none";
        pendingPayload = null;
    });

});