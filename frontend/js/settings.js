// ======================================
// Expense Tracker
// Settings Script — User-Specific Settings
// ======================================

const SETTINGS_API = `${API_BASE_URL}/api/settings`;

let currentUser = null;
let currentSettings = null;

document.addEventListener("DOMContentLoaded", () => {
    // Auth guard
    if (!authGuard()) return;

    loadCurrentUser();
    loadSettings();
    setupEventListeners();
});

// ======================================
// Load Current User
// ======================================

function loadCurrentUser() {
    try {
        const stored = localStorage.getItem("currentUser");
        if (stored) {
            currentUser = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load user from storage", e);
    }
}

// ======================================
// Load Settings from API
// ======================================

async function loadSettings() {
    if (!currentUser || !currentUser.id) {
        showMessageOnPage("User not logged in. Please login again.");
        return;
    }

    try {
        const response = await fetch(`${SETTINGS_API}/`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (!response.ok) {
            showMessageOnPage(data.message || "Failed to load settings");
            return;
        }

        currentSettings = data;
        populateSettings(data);
    } catch (error) {
        console.error("Settings load error:", error);
    }
}

// ======================================
// Populate Settings Fields
// ======================================

function populateSettings(data) {
    if (!data) return;

    // Theme radio buttons
    const themeRadio = document.querySelector(`input[name="theme"][value="${data.theme}"]`);
    if (themeRadio) {
        themeRadio.checked = true;
    }

    // Apply the theme immediately
    setTheme(data.theme);

    // Notifications toggle
    const notificationsToggle = document.getElementById("notificationsToggle");
    if (notificationsToggle) {
        notificationsToggle.checked = data.notifications === true;
    }
}

// ======================================
// Setup Event Listeners
// ======================================

function setupEventListeners() {
    // Theme radio buttons — apply immediately on click
    document.querySelectorAll('input[name="theme"]').forEach((radio) => {
        radio.addEventListener("change", function () {
            if (this.checked) {
                // Apply locally immediately
                setTheme(this.value);
            }
        });
    });

    // Save button
    const saveBtn = document.getElementById("saveSettingsBtn");
    if (saveBtn) {
        saveBtn.addEventListener("click", handleSaveSettings);
    }
}

// ======================================
// Handle Save Settings
// ======================================

async function handleSaveSettings() {
    // Gather all current values
    const selectedTheme = document.querySelector('input[name="theme"]:checked');
    const theme = selectedTheme ? selectedTheme.value : "light";

    const notifications = document.getElementById("notificationsToggle")
        ? document.getElementById("notificationsToggle").checked
        : true;

    const payload = {
        theme: theme,
        notifications: notifications,
    };

    try {
        const response = await fetch(`${SETTINGS_API}/`, {
            method: "PUT",
            headers: Object.assign(
                { "Content-Type": "application/json" },
                getAuthHeaders()
            ),
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok) {
            // Apply theme server-side confirmed
            setTheme(theme);
            showSuccess("Settings saved successfully!");

            if (currentSettings) {
                currentSettings = data.settings || data;
            }
        } else {
            const msg =
                data && data.message
                    ? data.message
                    : "Failed to save settings";
            showError(msg);
        }
    } catch (error) {
        console.error("Save settings error:", error);
        showError("Unable to connect to the server. Please check your connection.");
    }
}

// ======================================
// Apply Theme
// ======================================
// NOTE: We DO NOT define setTheme() here.
// The global setTheme() from app.js handles user-specific keys.
// All calls to setTheme() in this file resolve to the app.js version.

// ======================================
// Message Display Helpers
// ======================================

function showSuccess(message) {
    const el = document.getElementById("settingsMessage");
    if (!el) return;
    el.textContent = message;
    el.className = "form-message success";
    el.style.display = "block";
    setTimeout(() => {
        el.style.display = "none";
    }, 4000);
}

function showError(message) {
    const el = document.getElementById("settingsMessage");
    if (!el) return;
    el.textContent = message;
    el.className = "form-message error";
    el.style.display = "block";
    setTimeout(() => {
        el.style.display = "none";
    }, 5000);
}

function showMessageOnPage(message) {
    const section = document.querySelector(".settings-page");
    if (!section) return;

    const errorDiv = document.createElement("div");
    errorDiv.style.cssText =
        "padding:20px;background:#FEE2E2;color:#DC2626;border-radius:12px;text-align:center;font-weight:500;margin:20px;";
    errorDiv.textContent = message;
    section.prepend(errorDiv);
}




