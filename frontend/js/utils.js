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
// Reusable Error Message Extractor
// ======================================

/**
 * Safely extract the most relevant error message from a failed API call.
 * 
 * Priority:
 * 1. Backend JSON response "message" field (e.g. {"success": false, "message": "..."})
 * 2. Backend JSON response "error" field
 * 3. Fallback for actual network/unreachable errors
 * 
 * Generic JS errors like "Failed to fetch", "TypeError", "NetworkError" 
 * are NEVER shown to the user.
 *
 * @param {Error} error - The caught error object
 * @param {Response|null} response - The fetch Response object (if available)
 * @returns {string} A user-friendly error message
 */
async function extractErrorMessage(error, response) {
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
            // Response wasn't JSON - fall through to error-based handling
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
        return "Unable to connect to the server. Please check your connection.";
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

    return "Unable to connect to the server. Please check your connection.";
}

