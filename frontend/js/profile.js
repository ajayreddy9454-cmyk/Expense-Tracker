// ======================================
// Expense Tracker
// Profile Script
// ======================================

const PROFILE_API = "http://127.0.0.1:5000/api/profile";

let currentUser = null;
let profileData = null;

document.addEventListener("DOMContentLoaded", () => {
    // Auth guard
    if (!authGuard()) return;

    loadCurrentUser();
    loadProfile();
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
// Load Profile from API
// ======================================

async function loadProfile() {
    if (!currentUser || !currentUser.id) {
        showMessageOnPage("User not logged in. Please login again.");
        return;
    }

    try {
        const response = await fetch(`${PROFILE_API}/`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (!response.ok) {
            showMessageOnPage(data.message || "Failed to load profile");
            return;
        }

        profileData = data;
        populateProfile(data);
    } catch (error) {
        console.error("Profile load error:", error);
        // Show data from localStorage as fallback if available
        populateProfileFromLocalFallback();
    }
}

// ======================================
// Fallback to localStorage data if API fails
// ======================================

function populateProfileFromLocalFallback() {
    if (!currentUser) return;

    document.getElementById("profileHeaderName").textContent =
        currentUser.name || currentUser.full_name || "User";
    document.getElementById("profileHeaderEmail").textContent =
        currentUser.email || "";

    const navUserName = document.getElementById("navUserName");
    if (navUserName) {
        navUserName.textContent = currentUser.name || currentUser.full_name || "User";
    }

    document.getElementById("inputFullName").value =
        currentUser.name || currentUser.full_name || "";
    document.getElementById("inputEmail").value = currentUser.email || "";
}

// ======================================
// Populate Profile Fields
// ======================================

function populateProfile(data) {
    if (!data) return;

    // Header avatar
    updateAvatar(data.profile_image);

    // Header text
    document.getElementById("profileHeaderName").textContent =
        data.full_name || "User";
    document.getElementById("profileHeaderEmail").textContent =
        data.email || "";

    // Navbar user name
    const navUserName = document.getElementById("navUserName");
    if (navUserName) {
        navUserName.textContent = data.full_name || "User";
    }

    // Member since in header
    const memberSince = document.getElementById("profileMemberSince");
    if (memberSince) {
        memberSince.textContent = formatMemberDate(data.created_at);
    }

    // Personal Info fields
    document.getElementById("inputFullName").value = data.full_name || "";
    document.getElementById("inputEmail").value = data.email || "";
    document.getElementById("inputPhone").value = data.phone || "";
    document.getElementById("inputCountry").value = data.country || "";
    document.getElementById("inputOccupation").value = data.occupation || "";
    document.getElementById("inputDob").value = data.date_of_birth || "";

    // About Me
    document.getElementById("inputAboutMe").value = data.about_me || "";

    // Statistics
    document.getElementById("statTotalExpenses").textContent =
        Number(data.total_expenses || 0).toLocaleString();
    document.getElementById("statCategoriesUsed").textContent =
        Number(data.categories_used || 0).toLocaleString();
    document.getElementById("statBudgetsCreated").textContent =
        Number(data.budgets_created || 0).toLocaleString();

    const statMember = document.getElementById("statMemberSince");
    if (statMember) {
        statMember.textContent = formatMemberDate(data.created_at);
    }
}

// ======================================
// Update hero & navbar avatar images
// Uses shared updateNavbarAvatar from app.js
// ======================================

function updateAvatar(profileImagePath) {
    // Use the shared function from app.js that updates nav + header + localStorage
    if (typeof updateNavbarAvatar === "function") {
        updateNavbarAvatar(profileImagePath);
    } else {
        // Fallback if app.js hasn't loaded yet
        const src = (profileImagePath && profileImagePath.trim() !== "")
            ? `http://127.0.0.1:5000${profileImagePath}`
            : DEFAULT_AVATAR;

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

        localStorage.setItem("profile_image_url", src);
    }
}

// ======================================
// Format Member Since Date
// ======================================

function formatMemberDate(dateStr) {
    if (!dateStr || dateStr === "") return "---";
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "---";
        return date.toLocaleDateString("en-IN", {
            month: "short",
            year: "numeric",
        });
    } catch (e) {
        return "---";
    }
}

// ======================================
// Setup Event Listeners
// ======================================

function setupEventListeners() {
    const infoForm = document.getElementById("personalInfoForm");
    if (infoForm) infoForm.addEventListener("submit", handleSavePersonalInfo);

    const cancelBtn = document.getElementById("cancelInfoBtn");
    if (cancelBtn) cancelBtn.addEventListener("click", handleCancelInfo);

    const aboutBtn = document.getElementById("saveAboutBtn");
    if (aboutBtn) aboutBtn.addEventListener("click", handleSaveAbout);

    const passwordForm = document.getElementById("passwordForm");
    if (passwordForm) passwordForm.addEventListener("submit", handleChangePassword);

    // Click avatar wrapper to open file picker
    const avatarClickable = document.getElementById("avatarClickable");
    if (avatarClickable) {
        avatarClickable.addEventListener("click", function () {
            document.getElementById("avatarInput").click();
        });
    }

    // Immediately upload when a file is selected
    const avatarInput = document.getElementById("avatarInput");
    if (avatarInput) {
        avatarInput.addEventListener("change", handleAvatarUpload);
    }
}

// ======================================
// Handle Save Personal Info
// ======================================

async function handleSavePersonalInfo(e) {
    e.preventDefault();

    const fullName = document.getElementById("inputFullName").value.trim();
    const phone = document.getElementById("inputPhone").value.trim();
    const country = document.getElementById("inputCountry").value.trim();
    const occupation = document.getElementById("inputOccupation").value.trim();
    const dateOfBirth = document.getElementById("inputDob").value;

    if (!fullName) {
        showFormMessage("infoMessage", "Full name is required.", "error");
        return;
    }

    const payload = {
        full_name: fullName,
        phone: phone || "",
        country: country || "",
        occupation: occupation || "",
        date_of_birth: dateOfBirth || "",
    };

try {
        const response = await fetch(`${PROFILE_API}/`, {
            method: "PUT",
            headers: Object.assign({ "Content-Type": "application/json" }, getAuthHeaders()),
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok) {
            showFormMessage("infoMessage", "Profile updated successfully!", "success");
            document.getElementById("profileHeaderName").textContent = fullName;
            const navUserName = document.getElementById("navUserName");
            if (navUserName) navUserName.textContent = fullName;
            if (profileData) profileData.full_name = fullName;
        } else {
            const msg = data && data.message ? data.message : "Failed to update profile";
            showFormMessage("infoMessage", msg, "error");
        }
    } catch (error) {
        console.error("Save profile error:", error);
        const msg = await extractErrorMessage(error, null);
        showFormMessage("infoMessage", msg, "error");
    }
}

// ======================================
// Handle Cancel Info
// ======================================

function handleCancelInfo() {
    if (profileData) {
        document.getElementById("inputFullName").value = profileData.full_name || "";
        document.getElementById("inputPhone").value = profileData.phone || "";
        document.getElementById("inputCountry").value = profileData.country || "";
        document.getElementById("inputOccupation").value = profileData.occupation || "";
        document.getElementById("inputDob").value = profileData.date_of_birth || "";
    }
    clearMessage("infoMessage");
}

// ======================================
// Handle Save About Me
// ======================================

async function handleSaveAbout() {
    const aboutMe = document.getElementById("inputAboutMe").value.trim();

    // Save about_me via PUT – include full_name too so backend doesn't null it
    const fullName = document.getElementById("inputFullName").value.trim();

    const payload = {
        full_name: fullName || (profileData ? profileData.full_name : ""),
        about_me: aboutMe || "",
    };

try {
        const response = await fetch(`${PROFILE_API}/`, {
            method: "PUT",
            headers: Object.assign({ "Content-Type": "application/json" }, getAuthHeaders()),
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok) {
            showFormMessage("aboutMessage", "About Me saved successfully!", "success");
            if (profileData) profileData.about_me = aboutMe;
        } else {
            showFormMessage("aboutMessage", data.message || "Failed to save", "error");
        }
    } catch (error) {
        console.error("Save about error:", error);
        const msg = await extractErrorMessage(error, null);
        showFormMessage("aboutMessage", msg, "error");
    }
}

// ======================================
// Handle Change Password
// ======================================

async function handleChangePassword(e) {
    e.preventDefault();

    const currentPassword = document.getElementById("inputCurrentPassword").value;
    const newPassword = document.getElementById("inputNewPassword").value;
    const confirmPassword = document.getElementById("inputConfirmPassword").value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showFormMessage("passwordMessage", "All password fields are required.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        showFormMessage("passwordMessage", "New password and confirm password do not match.", "error");
        return;
    }

    if (newPassword.length < 6) {
        showFormMessage("passwordMessage", "New password must be at least 6 characters.", "error");
        return;
    }

try {
        const response = await fetch(`${PROFILE_API}/password`, {
            method: "PUT",
            headers: Object.assign({ "Content-Type": "application/json" }, getAuthHeaders()),
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword,
                confirm_password: confirmPassword,
            }),
        });

        const data = await response.json();

        if (response.ok) {
            showFormMessage("passwordMessage", "Password changed successfully!", "success");
            document.getElementById("passwordForm").reset();
        } else {
            showFormMessage("passwordMessage", data.message || "Failed to change password", "error");
        }
    } catch (error) {
        console.error("Change password error:", error);
        const msg = await extractErrorMessage(error, null);
        showFormMessage("passwordMessage", msg, "error");
    }
}

// ======================================
// Handle Avatar Upload
// ======================================

async function handleAvatarUpload(e) {
    const fileInput = e.target;
    const file = fileInput.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/png", "image/jpg", "image/jpeg", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
        showAvatarMessage("Invalid file type. Allowed: PNG, JPG, JPEG, GIF, WEBP", "error");
        fileInput.value = "";
        return;
    }

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
        showAvatarMessage("File too large. Maximum size is 5MB.", "error");
        fileInput.value = "";
        return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (event) => {
        const headerAvatar = document.getElementById("profileHeaderAvatar");
        if (headerAvatar) headerAvatar.src = event.target.result;
    };
    reader.readAsDataURL(file);

// Upload to server
    const formData = new FormData();
    formData.append("avatar", file);

    try {
        const response = await fetch(`${PROFILE_API}/avatar`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData,
        });

        const data = await response.json();

        if (response.ok) {
            showAvatarMessage("Profile picture updated successfully!", "success");

            // Update with the server URL for persistence
            if (data.profile_image) {
                updateAvatar(data.profile_image);
            }

            fileInput.value = "";
        } else {
            showAvatarMessage(data.message || "Failed to upload image", "error");
            // Revert to previous on failure
            updateAvatar(profileData ? profileData.profile_image : null);
        }
    } catch (error) {
        console.error("Upload avatar error:", error);
        showAvatarMessage("Network error. Could not upload image.", "error");
        // Revert to previous on network error
        updateAvatar(profileData ? profileData.profile_image : null);
    }
}

// ======================================
// Show avatar message in the hero card
// ======================================

function showAvatarMessage(message, type) {
    const el = document.getElementById("avatarMessage");
    if (!el) return;

    el.textContent = message;
    el.className = "form-message " + type;
    el.style.display = "block";

    if (type === "success") {
        setTimeout(() => {
            el.style.display = "none";
        }, 4000);
    }
}

// ======================================
// Utility: Show Form Messages
// ======================================

function showFormMessage(elementId, message, type) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.textContent = message;
    el.className = "form-message " + type;
    el.style.display = "block";

    if (type === "success") {
        setTimeout(() => {
            el.style.display = "none";
        }, 4000);
    }
}

function clearMessage(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = "";
    el.className = "form-message";
    el.style.display = "none";
}

// ======================================
// Utility: Show Page-Level Message
// ======================================

function showMessageOnPage(message) {
    const section = document.querySelector(".profile-page");
    if (!section) return;

    const errorDiv = document.createElement("div");
    errorDiv.style.cssText =
        "padding:20px;background:#FEE2E2;color:#DC2626;border-radius:12px;text-align:center;font-weight:500;margin:20px;";
    errorDiv.textContent = message;
    section.prepend(errorDiv);
}



