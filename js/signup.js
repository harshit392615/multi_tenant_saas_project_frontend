document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('signupForm');
    const nameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');
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
            // Change the eye icon slightly when visible (optional visual feedback)
            btn.style.opacity = isPassword ? '1' : '0.6';
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
    [nameInput, emailInput, passInput, confirmInput].forEach(input => {
        input?.addEventListener('input', () => {
            clearError(input);
            statusDiv.textContent = '';
            statusDiv.className = 'form-status';
        });
    });

    /* =====================================================
       3. FORM SUBMIT (Client-side checks)
    ===================================================== */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        let isValid = true;

        if (nameInput.value.trim() === '') {
            setError(nameInput, 'Full name is required');
            isValid = false;
        }

        if (emailInput.value.trim() === '') {
            setError(emailInput, 'Email is required');
            isValid = false;
        } else if (!validateEmail(emailInput.value)) {
            setError(emailInput, 'Please enter a valid email address');
            isValid = false;
        }

        if (passInput.value.length < 8) {
            setError(passInput, 'Password must be at least 8 characters');
            isValid = false;
        }

        if (confirmInput.value !== passInput.value) {
            setError(confirmInput, 'Passwords do not match');
            isValid = false;
        }

        if (!isValid) return;

        await handleSignup();
    });

    /* =====================================================
       4. API SIGNUP LOGIC (Backend error mapping)
    ===================================================== */
    /* =====================================================
       4. API SIGNUP LOGIC (Backend error mapping & Success UI)
    ===================================================== */
    async function handleSignup() {
        const submitBtn = form.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';
        statusDiv.textContent = '';
        statusDiv.className = 'form-status';

        const payload = {
            username: nameInput.value.trim(),
            email: emailInput.value.trim(),
            password: passInput.value
        };

        try {
            const response = await fetch('https://multi-tenant-saas-project.onrender.comsaas-project.onrender.comsaas-project.onrender.com/api/auth/signup/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
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
                    throw new Error(errors.message || errors.detail || errors.error || 'Signup failed. Please try again.');
                } else {
                    throw new Error('Please fix the errors above.');
                }
            }

            // --- UI Swap on Success ---
            const formContainer = document.getElementById('signupFormContainer');
            const successScreen = document.getElementById('successScreen');
            const emailDisplay = document.getElementById('userEmailDisplay');
            const headerTitle = document.getElementById('headerTitle');

            // Hide the form and the "Create your account" title
            formContainer.style.display = 'none';
            headerTitle.style.display = 'none';
            
            // Inject the user's email into the success screen
            emailDisplay.textContent = payload.email;
            
            // Show the success screen
            successScreen.style.display = 'block';

        } catch (error) {
            console.error('Signup Error:', error);
            statusDiv.className = 'form-status error';
            
            if (error.message !== 'Please fix the errors above.') {
                statusDiv.textContent = error.message;
            }
            
            // Only reset the button if there was an error
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign up';
        }
    }
});