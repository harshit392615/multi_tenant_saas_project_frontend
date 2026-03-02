document.addEventListener('DOMContentLoaded', () => {
    const verifyBtn = document.getElementById('verifyBtn');
    const verifyPending = document.getElementById('verifyPending');
    const verifySuccess = document.getElementById('verifySuccess');
    const verifyError = document.getElementById('verifyError');

    // 1. Extract query parameters from the URL
    // Example URL: http://yourdomain.com/verify.html?uid=123&token=abc
    const urlParams = new URLSearchParams(window.location.search);
    
    // Change 'uid' and 'token' to whatever your backend actually sends in the email link
    const uidb64 = urlParams.get('uidb64'); 
    const token = urlParams.get('token');

    // 2. Check if the link is valid right away
    if (!uidb64 || !token) {
        verifyBtn.disabled = true;
        verifyError.textContent = "Invalid or missing verification link. Please check your email and try again.";
        return;
    }

    // 3. Handle the Verify button click
    verifyBtn.addEventListener('click', async () => {
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';
        verifyError.textContent = '';

        try {
            // Replace with your actual backend endpoint
            const response = await fetch(`http://127.0.0.1:8000/api/auth/verify/${uidb64}/${token}/`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
            });

            if (response.status !== 204) {
                throw new Error(data.message || data.detail || 'Verification failed. The link may have expired.');
            }

            // --- Success State ---
            verifyPending.style.display = 'none';
            verifySuccess.style.display = 'block';

        } catch (error) {
            console.error('Verification Error:', error);
            verifyError.textContent = error.message;
            
            // Allow them to try again if it failed due to a network error
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify My Email';
        }
    });
});