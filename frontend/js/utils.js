// ======================================
// Expense Tracker
// Utility Functions & Shared Auth Helpers
// ======================================

// ======================================
// Centralized Backend API Base URL
// Change this single constant when deploying
// to a different backend server.
// ======================================
const API_BASE_URL = "https://expense-tracker-3k39.onrender.com";

// Default timeout for all API requests (ms)
const API_TIMEOUT_MS = 15000;

// ======================================
// AUTH HELPERS (shared across all pages)
// ======================================

/**
 * Check if user is logged in.
 * @returns {boolean}
 */
function isUserLoggedIn() {
    return localStorage.getItem("isLoggedIn") === "true" && localStorage.getItem("authToken") !== null;
}

/**
 * Get the currently logged-in user object from localStorage.
 * @returns {Object|null}
 */
function getCurrentUser() {
    try {
        const stored = localStorage.getItem("currentUser");
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        // ignore
    }
    return null;
}

/**
 * Get the auth token from localStorage.
 * @returns {string|null}
 */
function getAuthToken() {
    return localStorage.getItem("authToken");
}

/**
 * Get headers with Authorization Bearer token.
 * For JSON content, pass contentType = "application/json".
 * For FormData, omit contentType.
 * @param {string} [contentType] - Optional content type
 * @returns {Object} Headers object
 */
function getAuthHeaders(contentType) {
    const headers = {};
    const token = getAuthToken();
    if (token) {
        headers["Authorization"] = "Bearer " + token;
    }
    if (contentType) {
        headers["Content-Type"] = contentType;
    }
    return headers;
}

/**
 * Auth guard: redirect to login page if user is not authenticated.
 * Call this on DOMContentLoaded for all protected pages.
 */
function authGuard() {
    if (!isUserLoggedIn()) {
        window.location.href = "index.html";
        return false;
    }
    return true;
}

// ======================================
// GLOBAL SESSION EXPIRY HANDLER
// ======================================

/**
 * Called when the API returns 401 (token expired / invalid).
 * Clears session data and redirects to the login page so the user is
 * never stuck on a broken authenticated page.
 */
function handleSessionExpired() {
    // Avoid redirect loops if already on the login page
    const path = (window.location.pathname || "").split("/").pop();
    if (path === "index.html" || path === "register.html") {
        return;
    }

    try {
        const stored = localStorage.getItem("currentUser");
        let userId = null;
        if (stored) {
            const user = JSON.parse(stored);
            userId = user && user.id ? user.id : null;
        }
        localStorage.removeItem("currentUser");
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("profile_image_url");
        localStorage.removeItem("authToken");
        localStorage.removeItem("token");
        if (userId) {
            localStorage.removeItem("profile_image_url_" + userId);
            localStorage.removeItem("profile_image_ts_" + userId);
        }
        sessionStorage.clear();
    } catch (e) {
        // ignore
    }

    if (typeof showToast === "function") {
        showToast("Your session has expired. Please log in again.", "warning");
    }

    setTimeout(() => {
        window.location.href = "index.html";
    }, 300);
}

// ======================================
// Fetch with Timeout (prevents infinite hanging)
// ======================================

/**
 * fetch() wrapper that aborts after a configurable timeout so the UI
 * never hangs forever (e.g. while a free backend cold-starts).
 *
 * If the request times out, the promise rejects with an Error whose
 * `name` is "AbortError" / "TimeoutError". Callers should surface a
 * friendly message via extractErrorMessage().
 *
 * @param {string} url - Request URL
 * @param {Object} [options] - Standard fetch() options
 * @param {number} [timeoutMs=API_TIMEOUT_MS] - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, Object.assign({}, options, {
            signal: controller.signal
        }));
    } catch (err) {
        if (err && err.name === "AbortError") {
            const timeoutError = new Error("Request timed out");
            timeoutError.name = "TimeoutError";
            throw timeoutError;
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * fetch() wrapper that includes auth headers, applies a timeout, and
 * automatically logs the user out when the session is expired/invalid.
 *
 * @param {string} url - Request URL
 * @param {Object} [options] - Standard fetch() options (headers merged with Auth header)
 * @param {number} [timeoutMs=API_TIMEOUT_MS] - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
async function fetchWithAuth(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
    const headers = Object.assign({}, getAuthHeaders(), options.headers || {});

    const response = await fetchWithTimeout(url, Object.assign({}, options, { headers }), timeoutMs);

    // Session expired/invalid → force re-login
    if (response.status === 401) {
        handleSessionExpired();
    }

    return response;
}

// ======================================
// Button Loading State Helper
// ======================================

/**
 * Toggle a button's loading state: disable it, show a spinner, and
 * change its label. Always restore the original label via finally.
 *
 * Usage:
 *   setButtonLoading(btn, true, "Logging in...");
 *   try { ... } finally { setButtonLoading(btn, false); }
 *
 * @param {HTMLButtonElement} button - The button element
 * @param {boolean} isLoading - Whether to enter loading state
 * @param {string} [loadingText] - Text to show while loading
 */
function setButtonLoading(button, isLoading, loadingText) {
    if (!button) return;

    if (isLoading) {
        // Store original label once so we can restore it later
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        const spinner = document.createElement("span");
        spinner.className = "button-spinner";
        spinner.setAttribute("aria-hidden", "true");

        // Keep any existing icon, otherwise just spinner + text
        const icon = button.querySelector("i, svg, img");
        const label = loadingText || button.dataset.originalText;

        button.innerHTML = "";
        if (icon) {
            button.appendChild(icon);
        }
        button.appendChild(spinner);
        button.appendChild(document.createTextNode(" " + label));

        button.disabled = true;
        button.classList.add("is-loading");
    } else {
        button.innerHTML = button.dataset.originalText || button.textContent;
        button.disabled = false;
        button.classList.remove("is-loading");
        delete button.dataset.originalText;
    }
}

// ======================================
// Reusable Error Message Extractor
// ======================================

/**
 * Safely extract the most relevant error message from a failed API call.
 *
 * Priority:
 * 1. Backend JSON response "message" field (e.g. {"success": false, "message": "..."})
 * 2. Backend JSON response "error" field
 * 3. Response body text (non-HTML)
 * 4. Fallback for actual network/unreachable/timeout errors
 *
 * Generic JS errors like "Failed to fetch", "TypeError", "NetworkError"
 * are NEVER shown to the user.
 *
 * @param {Error} error - The caught error object
 * @param {Response|null} response - The fetch Response object (if available)
 * @returns {Promise<string>} A user-friendly error message
 */
async function extractErrorMessage(error, response) {
    // Timeout errors get a dedicated friendly message
    if (error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        return "Server is taking longer than expected. Please try again.";
    }

    if (response) {
        try {
            const data = await response.json();
            if (data && data.message) {
                return data.message;
            }
            if (data && data.error) {
                return data.error;
            }
        } catch (e) {
            // Response wasn't JSON - fall through to text-based handling
        }
    }

    if (response) {
        try {
            const text = await response.text().catch(() => "");
            if (text && text.trim()) {
                if (!text.trim().startsWith("<")) {
                    return text.trim();
                }
            }
        } catch (e) {
            // ignore
        }
    }

    if (!response && error) {
        return "Unable to connect to the server. Please try again.";
    }

    if (error && error.message) {
        const msg = error.message;
        const genericErrors = [
            "failed to fetch",
            "networkerror",
            "network error",
            "typeerror",
            "type error",
            "unexpected token",
            "load failed",
            "not found",
        ];
        const isGeneric = genericErrors.some(generic =>
            msg.toLowerCase().includes(generic)
        );
        if (!isGeneric) {
            return msg;
        }
    }

    return "Unable to connect to the server. Please try again.";
}

