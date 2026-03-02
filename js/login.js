document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const statusDiv = document.getElementById('formStatus');
    const toggleButtons = document.querySelectorAll('.toggle-password');

    /* =====================================================
       1. PASSWORD VISIBILITY TOGGLE
    ===================================================== */
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);

            if (!input) return;

            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
            btn.style.opacity = isPassword ? '1' : '0.6';
            
            // Keep focus on input so the user can keep typing easily
            input.focus();
        });
    });

    /* =====================================================
       2. VALIDATION & ERROR HELPERS
    ===================================================== */
    const setError = (input, message) => {
        const errorSpan = document.getElementById(input.id + 'Error');
        input.classList.add('invalid');
        input.setAttribute('aria-invalid', 'true');
        if (errorSpan) errorSpan.textContent = message;
    };

    const clearError = (input) => {
        const errorSpan = document.getElementById(input.id + 'Error');
        input.classList.remove('invalid');
        input.removeAttribute('aria-invalid');
        if (errorSpan) errorSpan.textContent = '';
    };

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    };

    // Live validation clearing when user types
    [emailInput, passwordInput].forEach(input => {
        input?.addEventListener('input', () => {
            clearError(input);
            statusDiv.textContent = '';
            statusDiv.className = 'form-status';
        });
    });

    /* =====================================================
       3. FORM SUBMIT & API CALL
    ===================================================== */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        let isValid = true;

        if (emailInput.value.trim() === '') {
            setError(emailInput, 'Email is required');
            isValid = false;
        } else if (!validateEmail(emailInput.value)) {
            setError(emailInput, 'Please enter a valid email address');
            isValid = false;
        }

        if (passwordInput.value.trim() === '') {
            setError(passwordInput, 'Password is required');
            isValid = false;
        }

        if (!isValid) return;

        await handleLogin();
    });

    async function handleLogin() {
        const submitBtn = form.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
        statusDiv.textContent = '';
        statusDiv.className = 'form-status';

        const payload = {
            email: emailInput.value.trim(),
            password: passwordInput.value.trim()
        };

        try {
            const response = await fetch('https://multi-tenant-saas-project.onrender.comsaas-project.onrender.comsaas-project.onrender.com/api/auth/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                // Check if backend returned field-specific errors
                let hasFieldErrors = false;

                const errors = data.error || data;

                if (typeof errors === 'object' && errors !== null) {
                    for (const key in errors) {
                        const inputField = document.getElementById(key);
                        if (inputField) {
                            hasFieldErrors = true;
                            const errorText = Array.isArray(errors[key]) ? errors[key][0] : errors[key];
                            setError(inputField, errorText);
                        }
                    }
                }

                if (!hasFieldErrors) {
                    throw new Error(errors.message || errors.detail || 'Invalid email or password.');
                } else {
                    throw new Error('Please fix the errors above.');
                }
            }

            // --- Success State ---
            statusDiv.className = 'form-status success';
            statusDiv.textContent = 'Login successful! Redirecting...';

            // Store Tokens
            if (data.access && data.refresh) {
                localStorage.setItem('access', data.access);
                localStorage.setItem('refresh', data.refresh);
            }

            // Redirect
            setTimeout(() => {
                window.location.href = '../html/dashboard.html';
            }, 800);

        } catch (error) {
            console.error('Login Error:', error);
            statusDiv.className = 'form-status error';
            
            if (error.message !== 'Please fix the errors above.') {
                statusDiv.textContent = error.message;
            }
            
            submitBtn.disabled = false;
            submitBtn.textContent = 'Log in';
        }
    }
    /* =====================================================
       4. FORGOT PASSWORD LOGIC
    ===================================================== */
    const forgotPwdLink = document.getElementById('forgot-password-link');
    const fpModal = document.getElementById('forgot-password-modal');
    
    const fpFormState = document.getElementById('fp-form-state');
    const fpSuccessState = document.getElementById('fp-success-state');
    
    const fpEmailInput = document.getElementById('fp-email-input');
    const fpError = document.getElementById('fp-error');
    const fpSuccessEmail = document.getElementById('fp-success-email');
    
    const btnCancelFp = document.getElementById('btn-cancel-fp');
    const btnSendFp = document.getElementById('btn-send-fp');
    const btnCloseFp = document.getElementById('btn-close-fp');

    // Open Modal
    if (forgotPwdLink) {
        forgotPwdLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Reset modal state
            fpFormState.style.display = 'block';
            fpSuccessState.style.display = 'none';
            fpEmailInput.value = '';
            fpError.textContent = '';
            fpEmailInput.style.borderColor = 'var(--border-color)';
            
            fpModal.style.display = 'flex';
            setTimeout(() => fpEmailInput.focus(), 100);
        });
    }

    // Close Modal actions
    const closeModal = () => { fpModal.style.display = 'none'; };
    if (btnCancelFp) btnCancelFp.addEventListener('click', closeModal);
    if (btnCloseFp) btnCloseFp.addEventListener('click', closeModal);
    
    // Close if clicked outside the card
    window.addEventListener('click', (e) => {
        if (e.target === fpModal) closeModal();
    });

    // Clear error on type
    fpEmailInput.addEventListener('input', () => {
        fpError.textContent = '';
        fpEmailInput.style.borderColor = 'var(--border-color)';
    });

    // Handle Send Click
    if (btnSendFp) {
        btnSendFp.addEventListener('click', async () => {
            const email = fpEmailInput.value.trim();

            if (!email) {
                fpError.textContent = 'Please enter your email address.';
                fpEmailInput.style.borderColor = 'var(--error)';
                return;
            }
            if (!validateEmail(email)) {
                fpError.textContent = 'Please enter a valid email address.';
                fpEmailInput.style.borderColor = 'var(--error)';
                return;
            }

            // UI Loading state
            btnSendFp.disabled = true;
            btnSendFp.textContent = 'Sending...';

            try {
                // IMPORTANT: Adjust this URL to match your backend's actual password reset endpoint
                const response = await fetch('https://multi-tenant-saas-project.onrender.comsaas-project.onrender.comsaas-project.onrender.comsaas-project.onrender.com/api/auth/forgot-password/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });

                const data = await response.json();

                if (response.status !== 200) {
                    throw new Error(data.message || data.detail || data.error || 'Failed to send reset link.');
                }

                // Success: Swap UI State
                fpSuccessEmail.textContent = email;
                fpFormState.style.display = 'none';
                fpSuccessState.style.display = 'block';

            } catch (error) {
                console.error('Password Reset Error:', error);
                fpError.textContent = error.message;
                fpEmailInput.style.borderColor = 'var(--error)';
            } finally {
                // Reset button
                btnSendFp.disabled = false;
                btnSendFp.textContent = 'Send Link';
            }
        });
    }
});