document.addEventListener('DOMContentLoaded', () => {

    const stateError = document.getElementById('state-error');
    const stateUnauth = document.getElementById('state-unauth');
    const stateAuth = document.getElementById('state-auth');
    
    const btnGoLogin = document.getElementById('btn-go-login');
    const btnAcceptInvite = document.getElementById('btn-accept-invite');
    const statusMessage = document.getElementById('status-message');

    // 1. Extract query parameter from URL (e.g., ?token=xyz123)
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('token'); 

    // If there is no token in the URL, show the error state
    if (!inviteToken) {
        stateError.style.display = 'block';
        return;
    }

    // 2. Check if user is authenticated locally
    const accessToken = localStorage.getItem('access');

    if (!accessToken) {
        // User is definitely not logged in (no token found): Show Unauth State
        stateUnauth.style.display = 'block';
        
        btnGoLogin.addEventListener('click', () => {
            // Pass current URL to login page
            const currentUrl = encodeURIComponent(window.location.href);
            window.location.href = `login.html?next=${currentUrl}`;
        });

    } else {
        // User HAS a token (Might be valid, might be expired): Show Auth State
        stateAuth.style.display = 'block';
        
        btnAcceptInvite.addEventListener('click', async () => {
            btnAcceptInvite.disabled = true;
            btnAcceptInvite.textContent = 'Accepting...';
            statusMessage.textContent = '';
            statusMessage.className = 'form-status';

            try {
                const response = await fetch('http://127.0.0.1:8000/api/invites/accept/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({ token: inviteToken })
                });

                // =========================================================
                // NEW LOGIC: Check if the token was actually valid
                // =========================================================
                if (response.status === 401) {
                    // Token is invalid or expired. 
                    // Clear the bad tokens and send them to the login page
                    localStorage.removeItem('access');
                    localStorage.removeItem('refresh');
                    
                    alert("Your session has expired. Please log in again to accept the invitation.");
                    
                    const currentUrl = encodeURIComponent(window.location.href);
                    window.location.href = `login.html?next=${currentUrl}`;
                    return; // Stop function execution here
                }

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || data.detail || data.error || 'Failed to accept invitation. It may have expired.');
                }

                // Success
                statusMessage.className = 'form-status success';
                statusMessage.textContent = 'Invitation accepted! Redirecting to your dashboard...';

                // Send user to the dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);

            } catch (error) {
                console.error('Accept Invite Error:', error);
                statusMessage.className = 'form-status error';
                statusMessage.textContent = error.message;
                
                btnAcceptInvite.disabled = false;
                btnAcceptInvite.textContent = 'Accept Invitation';
            }
        });
    }
});