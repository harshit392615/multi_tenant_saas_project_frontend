document.addEventListener('DOMContentLoaded', () => {
    const html = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');

const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    html.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

themeToggle?.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('.toggle-icon');
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

    // --- Elements ---
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    
    // Error spans
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const globalError = document.getElementById('globalError');

    // --- State helpers ---
    let isPasswordVisible = false;

    // --- 1. Password Visibility Toggle ---
    togglePasswordBtn.addEventListener('click', () => {
        isPasswordVisible = !isPasswordVisible;
        
        // Update input type
        passwordInput.type = isPasswordVisible ? 'text' : 'password';
        
        // Update Icons
        const eyeIcon = togglePasswordBtn.querySelector('.icon-eye');
        const eyeOffIcon = togglePasswordBtn.querySelector('.icon-eye-off');
        
        if (isPasswordVisible) {
            eyeIcon.style.display = 'none';
            eyeOffIcon.style.display = 'block';
            togglePasswordBtn.setAttribute('aria-label', 'Hide password');
        } else {
            eyeIcon.style.display = 'block';
            eyeOffIcon.style.display = 'none';
            togglePasswordBtn.setAttribute('aria-label', 'Show password');
        }

        // Keep focus on input to prevent breaking flow
        passwordInput.focus();
    });

    // --- 2. Validation Logic ---
    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    };

    const showError = (input, errorElement, message) => {
        input.classList.add('error');
        errorElement.textContent = message;
        input.setAttribute('aria-invalid', 'true');
    };

    const clearError = (input, errorElement) => {
        input.classList.remove('error');
        errorElement.textContent = '';
        input.removeAttribute('aria-invalid');
        globalError.textContent = ''; // Clear global error on any input
    };

    // --- 3. Event Listeners for Inputs (Clear errors on type) ---
    emailInput.addEventListener('input', () => clearError(emailInput, emailError));
    passwordInput.addEventListener('input', () => clearError(passwordInput, passwordError));

    // --- 4. Form Submission (UPDATED WITH API) ---
    // Note the 'async' keyword here to allow awaiting the server response
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let isValid = true;
        const emailValue = emailInput.value.trim();
        const passwordValue = passwordInput.value.trim();

        // Email Validation
        if (!emailValue) {
            showError(emailInput, emailError, 'Email is required');
            isValid = false;
        } else if (!validateEmail(emailValue)) {
            showError(emailInput, emailError, 'Please enter a valid email address');
            isValid = false;
        }

        // Password Validation
        if (!passwordValue) {
            showError(passwordInput, passwordError, 'Password is required');
            isValid = false;
        }

        // Proceed if valid
        if (isValid) {
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            
            // 1. UI Loading State
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';
            globalError.textContent = ''; // Clear previous global errors

            try {
                // 2. Send Data to Server
                // REPLACE THIS URL with your actual backend endpoint
                const response = await fetch('http://127.0.0.1:8000/api/auth/login/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }, 
                    body: JSON.stringify({
                        email: emailValue,
                        password: passwordValue
                    })
                });

                const data = await response.json();

                // 3. Handle Server Errors (e.g., 401 Wrong Password)
                if (!response.ok) {
                    throw new Error(data.message || 'Invalid email or password.');
                }

                // 4. Success Handling
                console.log('Login successful:', data);

                // Store the token (JWT) if your API sends one
                if (data.access && data.refresh) {
                    localStorage.setItem('access', data.access);
                    localStorage.setItem('refresh',data.refresh)
                }

                // Redirect user to dashboard
                window.location.href = '../html/dashboard.html';


            } catch (error) {
                // 5. Error Handling
                console.error('Login error:', error);
                
                // Display the error in the Global Error div
                globalError.textContent = error.message;

                // Reset button state
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        }
    });
});