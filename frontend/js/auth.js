// ======================================
// Expense Tracker
// Authentication Script
// ======================================

document.addEventListener("DOMContentLoaded", () => {

    initializeLogin();
    initializeRegister();

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

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

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
            document.getElementById("password").value = "";
            document.getElementById("password").focus();
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
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
                document.getElementById("password").value = "";
                document.getElementById("password").focus();
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
            alert("Login Error: " + err.message);
            showError("Connection error. Please try again.");
        }
    });
}

// ======================================
// Register
// ======================================

function initializeRegister() {

    const form = document.getElementById("registerForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const full_name = document.getElementById("reg_full_name").value.trim();
        const email = document.getElementById("reg_email").value.trim();
        const password = document.getElementById("reg_password").value;

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

        try {
            // Register — backend now returns token directly
            const registerResponse = await fetch(`${API_BASE_URL}/api/auth/register`, {
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
            showError("Connection error. Please try again.");
        }
    });
}

// ======================================
// Logout
// ======================================

function logout() {

    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("profile_image_url");
    localStorage.removeItem("authToken");

    window.location.href = "index.html";

}

function showError(message) {
    if (typeof showToast === "function") {
        showToast(message, "error");
    } else {
        console.error(message);
    }
}

