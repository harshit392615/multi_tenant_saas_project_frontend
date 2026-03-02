document.addEventListener('DOMContentLoaded', () => {
    
    // The target URL where the user should go after success
    const DASHBOARD_URL = "dashboard.html#billing"; 
    
    let seconds = 5;
    const countdownEl = document.getElementById("countdown");
    const btnGoDashboard = document.getElementById("btn-go-dashboard");

    // 1. Start the countdown timer
    const interval = setInterval(() => {
        seconds--;
        countdownEl.textContent = seconds;
        
        if (seconds <= 0) {
            clearInterval(interval);
            redirectToDashboard();
        }
    }, 1000);

    // 2. Handle manual button click
    if (btnGoDashboard) {
        btnGoDashboard.addEventListener("click", () => {
            clearInterval(interval); // Stop the timer so it doesn't double-fire
            redirectToDashboard();
        });
    }

    // Helper function for redirection
    function redirectToDashboard() {
        // Adding #billing will automatically open the billing tab 
        // if your router is set up correctly!
        window.location.href = DASHBOARD_URL;
    }
});