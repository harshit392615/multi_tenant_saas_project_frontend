document.addEventListener('DOMContentLoaded', () => {

    /* =====================================================
       1. ELEMENTS
    ===================================================== */
    const html = document.documentElement;
    const form = document.getElementById('signupForm');
    const nameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');
    const statusDiv = document.getElementById('formStatus');
    const toggleButtons = document.querySelectorAll('.toggle-password');
    const themeToggle = document.getElementById('theme-toggle');


    /* =====================================================
       2. THEME TOGGLE (Persistent)
    ===================================================== */
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme) {
        html.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = html.getAttribute('data-theme');
            const newTheme = current === 'dark' ? 'light' : 'dark';

            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }

    function updateThemeIcon(theme) {
        const icon = themeToggle?.querySelector('.toggle-icon');
        if (icon) {
            icon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }


    /* =====================================================
       3. PASSWORD VISIBILITY TOGGLE
    ===================================================== */
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);

            if (!input) return;

            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';

            btn.setAttribute(
                'aria-label',
                isPassword ? 'Hide password' : 'Show password'
            );

            // Optional icon swap (if using icon-eye / icon-eye-off)
            const iconEye = btn.querySelector('.icon-eye');
            const iconOff = btn.querySelector('.icon-eye-off');

            if (iconEye && iconOff) {
                iconEye.classList.toggle('hidden');
                iconOff.classList.toggle('hidden');
            }
        });
    });


    /* =====================================================
       4. VALIDATION HELPERS
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

    // Live validation clearing
    [nameInput, emailInput, passInput, confirmInput].forEach(input => {
        input?.addEventListener('input', () => {
            clearError(input);
            statusDiv.textContent = '';
            statusDiv.className = 'form-status';
        });
    });


    /* =====================================================
       5. FORM SUBMIT
    ===================================================== */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        let isValid = true;

        // Name
        if (nameInput.value.trim() === '') {
            setError(nameInput, 'Full name is required');
            isValid = false;
        }

        // Email
        if (emailInput.value.trim() === '') {
            setError(emailInput, 'Email is required');
            isValid = false;
        } else if (!validateEmail(emailInput.value)) {
            setError(emailInput, 'Please enter a valid email address');
            isValid = false;
        }

        // Password
        if (passInput.value.length < 8) {
            setError(passInput, 'Password must be at least 8 characters');
            isValid = false;
        }

        // Confirm
        if (confirmInput.value !== passInput.value) {
            setError(confirmInput, 'Passwords do not match');
            isValid = false;
        }

        if (!isValid) return;

        await handleSignup();
    });


    /* =====================================================
       6. API SIGNUP LOGIC
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
            const response = await fetch(
                'http://127.0.0.1:8000/api/auth/signup/',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.detail ||
                    'Signup failed. Please try again.'
                );
            }

            // Success
            statusDiv.className = 'form-status success';
            statusDiv.textContent = 'Account created successfully! Redirecting...';

            if (data.token) {
                localStorage.setItem('authToken', data.token);
            }

            setTimeout(() => {
                window.location.href = '../html/login.html';
            }, 1000);

        } catch (error) {

            console.error('Signup Error:', error);

            statusDiv.className = 'form-status error';
            statusDiv.textContent = error.message;

            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign up';
        }
    }

});
