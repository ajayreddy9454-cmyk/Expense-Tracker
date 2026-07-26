// ======================================
// Expense Tracker
// Common Application Script
// ======================================

document.addEventListener("DOMContentLoaded", async () => {

    initializeSidebar();

    initializeTheme();

    initializeLogout();

    setActiveMenu();

    initializeProfileDropdown();

    loadNavbarUser();

    // Load the user's avatar on every page
    await loadNavbarAvatar();

});

// ======================================
// Sidebar Toggle
// ======================================

function initializeSidebar() {

    const sidebar = document.querySelector(".sidebar");

    const menuBtn = document.querySelector(".menu-btn");

    if (!sidebar || !menuBtn) return;

    // Create overlay backdrop for mobile sidebar
    let overlay = document.querySelector(".sidebar-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "sidebar-overlay";
        document.body.appendChild(overlay);
    }

    menuBtn.addEventListener("click", () => {
        // On mobile (width < 768px), toggle sidebar as overlay
        if (window.innerWidth < 768) {
            sidebar.classList.toggle("mobile-open");
            overlay.classList.toggle("active");
        } else {
            // On tablet/desktop, toggle collapse
            sidebar.classList.toggle("collapsed");
        }
    });

    // Close sidebar when clicking overlay
    overlay.addEventListener("click", () => {
        sidebar.classList.remove("mobile-open");
        overlay.classList.remove("active");
    });

    // Close sidebar when clicking a menu item on mobile
    const menuItems = sidebar.querySelectorAll("nav a, .logout");
    menuItems.forEach(item => {
        item.addEventListener("click", () => {
            if (window.innerWidth < 768) {
                sidebar.classList.remove("mobile-open");
                overlay.classList.remove("active");
            }
        });
    });

    // Handle window resize: reset sidebar state on breakpoint change
    window.addEventListener("resize", () => {
        if (window.innerWidth >= 768) {
            sidebar.classList.remove("mobile-open");
            overlay.classList.remove("active");
        }
    });

}

// ======================================
// Theme System — User-Specific
// ======================================

function getUserIdForStorage() {
    try {
        const stored = localStorage.getItem("currentUser");
        if (stored) {
            const user = JSON.parse(stored);
            return user && user.id ? user.id : null;
        }
    } catch (e) {}
    return null;
}

function initializeTheme() {

    // Load theme from user-specific key only
    const userId = getUserIdForStorage();
    let savedTheme = null;

    if (userId) {
        savedTheme = localStorage.getItem("theme_" + userId);
    }

    // Default to light if no user-specific theme is saved
    if (savedTheme === "dark") {

        document.body.classList.add("dark-mode");

    } else {

        document.body.classList.remove("dark-mode");

    }

}

// Call this from settings page to save theme
function setTheme(theme) {

    // Save to user-specific key only — never use a global key
    const userId = getUserIdForStorage();
    if (userId) {
        localStorage.setItem("theme_" + userId, theme);
    }

    if (theme === "dark") {

        document.body.classList.add("dark-mode");

    } else {

        document.body.classList.remove("dark-mode");

    }

}

// Get user-specific theme (used by settings page)
function getTheme() {
    const userId = getUserIdForStorage();
    if (userId) {
        const t = localStorage.getItem("theme_" + userId);
        if (t) return t;
    }
    return "light";
}

// ======================================
// Active Sidebar Menu
// ======================================

function setActiveMenu() {

    const currentPage = window.location.pathname.split("/").pop();


    // All sidebar menu items are <li> under the sidebar nav.
    const items = document.querySelectorAll(".sidebar nav ul > li");
    if (!items || items.length === 0) return;

    // Mapping used when <a href> isn't available in the markup.
    const pageByLabel = {
        Dashboard: "dashboard.html",
        "Add Expense": "add_expense.html",
        Expenses: "expenses.html",
        Categories: "categories.html",
        Reports: "reports.html",
        Budget: "budget.html",
        Profile: "profile.html",
        Settings: "settings.html"
    };

    // Remove active from all items first.
    items.forEach(li => li.classList.remove("active"));

    items.forEach(li => {
        // Prefer href match when <a href> exists.
        const link = li.querySelector("a[href]");
        if (link) {
            const href = link.getAttribute("href");
            if (href === currentPage) li.classList.add("active");
            return;
        }

        // Fallback: match based on the visible label text.
        const labelEl = li.querySelector("span");
        const label = (labelEl && labelEl.textContent ? labelEl.textContent.trim() : "");
        const expectedPage = pageByLabel[label];
        if (expectedPage && expectedPage === currentPage) {
            li.classList.add("active");
        }
    });
}

// ======================================
// Logout
// ======================================

function initializeLogout() {

    const logoutBtn = document.querySelector(".logout");

    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", () => {

        showConfirmModal({
            title: "Logout",
            message: "Are you sure you want to logout?",
            confirmText: "Yes, Logout",
            cancelText: "Cancel",
            icon: "warning",
            confirmClass: "modal-confirm-btn-primary",
            onConfirm: () => {
                performLogout();
            },
            onCancel: () => {}
        });

    });

    // Also handle dropdown logout button
    const dropdownLogoutBtn = document.getElementById("dropdownLogoutBtn");
    if (dropdownLogoutBtn) {
        dropdownLogoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            showConfirmModal({
                title: "Logout",
                message: "Are you sure you want to logout?",
                confirmText: "Yes, Logout",
                cancelText: "Cancel",
                icon: "warning",
                confirmClass: "modal-confirm-btn-primary",
                onConfirm: () => {
                    performLogout();
                },
                onCancel: () => {}
            });
        });
    }

}

// ======================================
// Perform Full Logout
// ======================================

function performLogout() {
    // Get user ID for clearing user-specific keys
    let userId = null;
    try {
        const stored = localStorage.getItem("currentUser");
        if (stored) {
            const user = JSON.parse(stored);
            userId = user && user.id ? user.id : null;
        }
    } catch (e) {}

    // Clear all authentication data from localStorage
    localStorage.removeItem("currentUser");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("profile_image_url");
    localStorage.removeItem("authToken");
    localStorage.removeItem("token");

    // Clear user-specific cached items if we know the user ID
    if (userId) {
        localStorage.removeItem("profile_image_url_" + userId);
    }

    // Clear sessionStorage
    sessionStorage.clear();

    // Redirect to login page
    window.location.href = "index.html";
}

// ======================================
// Profile Dropdown
// ======================================

function initializeProfileDropdown() {

    const profileEl = document.querySelector(".profile");

    const dropdown = document.querySelector(".dropdown-menu");

    if (!profileEl || !dropdown) return;

    // Toggle dropdown on profile click
    profileEl.addEventListener("click", (e) => {

        e.stopPropagation();

        dropdown.classList.toggle("show");

        profileEl.classList.toggle("active");

    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {

        if (!profileEl.contains(e.target)) {

            dropdown.classList.remove("show");

            profileEl.classList.remove("active");

        }

    });

    // Close dropdown on escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            dropdown.classList.remove("show");
            profileEl.classList.remove("active");
        }
    });

}

// ======================================
// Load Navbar User Name
// ======================================

function loadNavbarUser() {
    const userNameEl = document.getElementById("navUserName");
    if (!userNameEl) return;

    // Try to get user data from localStorage
    try {
        const stored = localStorage.getItem("currentUser");
        if (stored) {
            const user = JSON.parse(stored);
            // Extract first name from full name
            let displayName = "User";
            if (user.full_name) {
                const parts = user.full_name.trim().split(/\s+/);
                displayName = parts[0]; // First name only
            } else if (user.name) {
                const parts = user.name.trim().split(/\s+/);
                displayName = parts[0];
            } else if (user.username) {
                displayName = user.username;
            } else if (user.email) {
                displayName = user.email.split("@")[0];
            }
            userNameEl.textContent = displayName;
        } else {
            userNameEl.textContent = "User";
        }
    } catch (e) {
        userNameEl.textContent = "User";
    }
}

// ======================================
// Shared Avatar Loader for ALL pages
// ======================================

const DEFAULT_AVATAR = "assets/images/default-avatar.png";
const PROFILE_API_URL = `${API_BASE_URL}/api/profile`;

function getAvatarCacheKey() {
    const userId = getUserIdForStorage();
    return userId ? "profile_image_url_" + userId : "profile_image_url";
}

async function loadNavbarAvatar() {
    const navAvatar = document.getElementById("navProfileAvatar");
    if (!navAvatar) return;

    const cacheKey = getAvatarCacheKey();

    // 1. Try localStorage cache first (fastest)
    const cachedSrc = localStorage.getItem(cacheKey);
    if (cachedSrc) {
        navAvatar.src = cachedSrc;
        navAvatar.onerror = function () {
            if (this.src !== DEFAULT_AVATAR) {
                this.onerror = null;
                this.src = DEFAULT_AVATAR;
            }
        };
    }

// 2. Try to get user from localStorage 
    let userId = null;
    try {
        const stored = localStorage.getItem("currentUser");
        if (stored) {
            const user = JSON.parse(stored);
            userId = user.id;
        }
    } catch (e) {
        // ignore
    }

    if (!userId) return;

    // 3. Fetch from API to get the latest avatar
    try {
        const response = await fetch(`${PROFILE_API_URL}/`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) return;

        const data = await response.json();
        if (!data || !data.profile_image) {
            // No profile image set, use default
            navAvatar.src = DEFAULT_AVATAR;
            navAvatar.onerror = null;
            localStorage.removeItem(cacheKey);
            return;
        }

        const src = `${API_BASE_URL}${data.profile_image}`;
        navAvatar.src = src;
        navAvatar.onerror = function () {
            if (this.src !== DEFAULT_AVATAR) {
                this.onerror = null;
                this.src = DEFAULT_AVATAR;
            }
        };

        // Cache in localStorage (user-specific key)
        localStorage.setItem(cacheKey, src);
    } catch (error) {
        // If API fails but we had cached, keep it
        console.error("Failed to load profile for avatar:", error);
    }
}

// ======================================
// Shared: Update avatar src and cache
// ======================================

function updateNavbarAvatar(profileImagePath) {
    const src = (profileImagePath && profileImagePath.trim() !== "")
        ? `${API_BASE_URL}${profileImagePath}`
        : DEFAULT_AVATAR;

    // Update navbar avatar
    const navAvatar = document.getElementById("navProfileAvatar");
    if (navAvatar) {
        navAvatar.src = src;
        navAvatar.onerror = function () {
            if (this.src !== DEFAULT_AVATAR) {
                this.onerror = null;
                this.src = DEFAULT_AVATAR;
            }
        };
    }

    // Update profile page header avatar if it exists
    const headerAvatar = document.getElementById("profileHeaderAvatar");
    if (headerAvatar) {
        headerAvatar.src = src;
        headerAvatar.onerror = function () {
            if (this.src !== DEFAULT_AVATAR) {
                this.onerror = null;
                this.src = DEFAULT_AVATAR;
            }
        };
    }

    // Cache in localStorage (user-specific key)
    const cacheKey = getAvatarCacheKey();
    localStorage.setItem(cacheKey, src);
}

