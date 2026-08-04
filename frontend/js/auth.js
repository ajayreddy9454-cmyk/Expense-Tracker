// ======================================
// Expense Tracker
// Authentication Script
// ======================================

document.addEventListener("DOMContentLoaded", () => {

    initializeLogin();
    initializeRegister();
    initializeForgotPassword();
    initializeResetPassword();

    // Redirect to dashboard if already logged in
    if (isUserLoggedIn() && (window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("register.html"))) {
        window.location.href = "dashboard.html";
    }

});

// ======================================
// Email Validation
// ======================================

function isValidEmail(email) {

    // Accept any valid email format
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

}

// ======================================
// Login
// ======================================

function initializeLogin() {

    const form = document.getElementById("loginForm");
    if (!form) return;

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const button = document.getElementById("loginButton");

    if (!emailInput || !passwordInput || !button) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Prevent duplicate submissions while a request is in flight
        if (button.disabled) return;

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Check for empty email AND empty password
        if (!email && !password) {
            showError("Email and password are required.");
            return;
        }

        // Check for empty email only
        if (!email) {
            showError("Email and password are required.");
            return;
        }

        // Check for empty password only
        if (!password) {
            showError("Email and password are required.");
            return;
        }

        // Validate email format
        if (!isValidEmail(email)) {
            showError("Invalid credentials. Please check your email and password.");
            // Clear only the password field, keep email
            passwordInput.value = "";
            passwordInput.focus();
            return;
        }

        setButtonLoading(button, true, "Logging in...");

        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                const backendMsg = data && (data.message || data.error) ? (data.message || data.error) : "Invalid credentials. Please check your email and password.";
                showError(backendMsg);
                // Clear only the password field, keep email
                passwordInput.value = "";
                passwordInput.focus();
                return;
            }

            // Backend returns user + token on success
            const user = data && (data.user || data);
            const token = data && data.token;

            localStorage.setItem("currentUser", JSON.stringify(user));
            localStorage.setItem("isLoggedIn", "true");
            if (token) {
                localStorage.setItem("authToken", token);
            }

            window.location.href = "dashboard.html";
        } catch (err) {
            console.error("Login Error:", err);
            const msg = await extractErrorMessage(err, null);
            showError(msg);
        } finally {
            // Always re-enable the button so it is never stuck loading
            setButtonLoading(button, false);
        }
    });
}

// ======================================
// Register
// ======================================

function initializeRegister() {

    const form = document.getElementById("registerForm");
    if (!form) return;

    const fullNameInput = document.getElementById("reg_full_name");
    const emailInput = document.getElementById("reg_email");
    const passwordInput = document.getElementById("reg_password");
    const button = document.getElementById("registerButton");

    if (!fullNameInput || !emailInput || !passwordInput || !button) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Prevent duplicate submissions while a request is in flight
        if (button.disabled) return;

        const full_name = fullNameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Validate fields
        if (!full_name || !email || !password) {
            showError("All fields are required");
            return;
        }

        // Validate email format
        if (!isValidEmail(email)) {
            showError("Please enter a valid email address");
            return;
        }

        setButtonLoading(button, true, "Creating Account...");

        try {
            // Register — backend now returns token directly
            const registerResponse = await fetchWithTimeout(`${API_BASE_URL}/api/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ full_name, email, password })
            });

            const registerData = await registerResponse.json().catch(() => null);

            if (!registerResponse.ok) {
                const backendMsg = registerData && (registerData.message || registerData.error) ? (registerData.message || registerData.error) : "Registration failed";
                showError(backendMsg);
                return;
            }

            // Auto-login from register response (backend returns token + user)
            const user = registerData && (registerData.user || registerData);
            const token = registerData && registerData.token;

            localStorage.setItem("currentUser", JSON.stringify(user));
            localStorage.setItem("isLoggedIn", "true");
            if (token) {
                localStorage.setItem("authToken", token);
            }

            if (typeof showToast === "function") {
                showToast("Account created successfully! Welcome!", "success");
            }
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 500);
        } catch (err) {
            console.error("Register Error:", err);
            const msg = await extractErrorMessage(err, null);
            showError(msg);
        } finally {
            // Always re-enable the button so it is never stuck loading
            setButtonLoading(button, false);
        }
    });
}

// ======================================
// Forgot Password
// ======================================

function initializeForgotPassword() {

    const form = document.getElementById("forgotPasswordForm");
    if (!form) return;

    const emailInput = document.getElementById("forgot_email");
    const button = document.getElementById("forgotPasswordButton");
    const messageEl = form.querySelector(".form-message");

    if (!emailInput || !button) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (button.disabled) return;

        const email = emailInput.value.trim();

        if (!email) {
            showError("Please enter your email address.");
            return;
        }

        if (!isValidEmail(email)) {
            showError("Please enter a valid email address.");
            return;
        }

        setButtonLoading(button, true, "Sending...");

        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/forgot-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                const msg = (data && data.message) || "Unable to process your request. Please try again.";
                showError(msg);
                return;
            }

            // SMTP not configured — show the reset link so the flow works
            if (data && data.reset_url) {
                if (messageEl) {
                    messageEl.innerHTML =
                        "Password reset link generated. " +
                        '<a href="' + escapeHtml(data.reset_url) + '" target="_blank" rel="noopener">Open reset page</a> ' +
                        "(if your server has no email configured, use this link.)";
                    messageEl.className = "form-message success";
                    messageEl.style.display = "block";
                } else {
                    showToast("Check your email for the reset link.", "success");
                }
                form.reset();
                return;
            }

            showToast(data && data.message ? data.message : "If an account exists for that email, a reset link has been sent.", "success");
            form.reset();
        } catch (err) {
            console.error("Forgot password error:", err);
            const msg = await extractErrorMessage(err, null);
            showError(msg);
        } finally {
            setButtonLoading(button, false);
        }
    });
}

// ======================================
// Reset Password
// ======================================

function initializeResetPassword() {

    const form = document.getElementById("resetPasswordForm");
    if (!form) return;

    const passwordInput = document.getElementById("reset_password");
    const confirmInput = document.getElementById("reset_confirm_password");
    const button = document.getElementById("resetPasswordButton");
    const messageEl = form.querySelector(".form-message");

    if (!passwordInput || !confirmInput || !button) return;

    // Extract token from URL query string
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (button.disabled) return;

        const newPassword = passwordInput.value;
        const confirmPassword = confirmInput.value;

        if (!token) {
            showError("Reset link is invalid or missing. Please request a new one.");
            return;
        }

        if (!newPassword || newPassword.length < 6) {
            showError("New password must be at least 6 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            showError("New password and confirm password do not match.");
            return;
        }

        setButtonLoading(button, true, "Resetting...");

        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/reset-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ token, new_password: newPassword })
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                const msg = (data && data.message) || "Unable to reset password. Please try again.";
                showError(msg);
                return;
            }

            if (messageEl) {
                messageEl.textContent = "Password reset successfully! Redirecting to sign in...";
                messageEl.className = "form-message success";
                messageEl.style.display = "block";
            }

            setTimeout(() => {
                window.location.href = "index.html";
            }, 1500);
        } catch (err) {
            console.error("Reset password error:", err);
            const msg = await extractErrorMessage(err, null);
            showError(msg);
        } finally {
            setButtonLoading(button, false);
        }
    });
}

function showError(message) {
    if (typeof showToast === "function") {
        showToast(message, "error");
    } else {
        console.error(message);
    }
}

