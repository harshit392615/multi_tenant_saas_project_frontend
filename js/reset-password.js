document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('resetPasswordForm');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const statusDiv = document.getElementById('formStatus');
    const submitBtn = document.getElementById('submitBtn');
    const toggleButtons = document.querySelectorAll('.toggle-password');

    // 1. Extract URL Parameters
    // Example URL: yoursite.com/reset-password.html?uid=123&token=abc
    const urlParams = new URLSearchParams(window.location.search);
    const paramUid = urlParams.get('uidb64'); 
    const paramToken = urlParams.get('token');

    // Prevent submission if the link is invalid/missing parameters
    if (!paramUid || !paramToken) {
        submitBtn.disabled = true;
        statusDiv.className = 'form-status error';
        statusDiv.textContent = "Invalid or expired reset link. Please request a new password reset.";
    }

    // 2. Password Visibility Toggle
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;

            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
            btn.style.opacity = isPassword ? '1' : '0.6';
            input.focus();
        });
    });

    // 3. Validation Helpers
    const setError = (input, message) => {
        const errorSpan = document.getElementById(input.id + 'Error');
        input.classList.add('invalid');
        if (errorSpan) errorSpan.textContent = message;
    };

    const clearError = (input) => {
        const errorSpan = document.getElementById(input.id + 'Error');
        input.classList.remove('invalid');
        if (errorSpan) errorSpan.textContent = '';
    };

    // Clear errors when typing
    [newPasswordInput, confirmPasswordInput].forEach(input => {
        input?.addEventListener('input', () => {
            clearError(input);
            statusDiv.textContent = '';
        });
    });

    // 4. Handle Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Failsafe check
        if (!paramUid || !paramToken) return;

        let isValid = true;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (newPassword.length < 8) {
            setError(newPasswordInput, 'Password must be at least 8 characters');
            isValid = false;
        }

        if (newPassword !== confirmPassword) {
            setError(confirmPasswordInput, 'Passwords do not match');
            isValid = false;
        }

        if (!isValid) return;

        // 5. Send POST Request
        submitBtn.disabled = true;
        submitBtn.textContent = 'Resetting...';
        statusDiv.className = 'form-status';

        // Construct the payload with the new password AND the URL parameters
        const payload = {
            new_password: newPassword,
            uidb64: paramUid,
            token: paramToken
        };

        try {
            // Replace with your actual backend endpoint
            const response = await fetch('https://multi-tenant-saas-project.onrender.com/api/auth/forgot-password-reset/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.detail || 'Failed to reset password. The link may have expired.');
            }

            // Success State
            statusDiv.className = 'form-status success';
            statusDiv.textContent = 'Password reset successfully! Redirecting to login...';

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);

        } catch (error) {
            console.error('Reset Error:', error);
            statusDiv.className = 'form-status error';
            statusDiv.textContent = error.message;
            
            submitBtn.disabled = false;
            submitBtn.textContent = 'Reset Password';
        }
    });
});