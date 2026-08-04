// ======================================
// Expense Tracker
// Categories Script
// ======================================

document.addEventListener("DOMContentLoaded", () => {

    // Auth guard first
    if (!authGuard()) return;

    loadCategories();

    // Add Category button
    const addBtn = document.getElementById("add-category-btn");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            openModal(null);
        });
    }

    // Modal close
    const modalCloseBtn = document.getElementById("modal-close-btn");
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);

    const modalCancelBtn = document.getElementById("modal-cancel-btn");
    if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);

    const modalOverlay = document.getElementById("category-modal-overlay");
    if (modalOverlay) {
        modalOverlay.addEventListener("click", (e) => {
            if (e.target === e.currentTarget) closeModal();
        });
    }

    // Save button
    const saveBtn = document.getElementById("modal-save-btn");
    if (saveBtn) saveBtn.addEventListener("click", saveCategory);

    // Search
    const searchInput = document.getElementById("category-search");
    if (searchInput) searchInput.addEventListener("input", filterCategories);

    // Event delegation: ONE listener on the grid for edit + delete buttons.
    // This avoids re-attaching listeners on every render/filter keystroke.
    const grid = document.getElementById("categories-grid");
    if (grid) {
        grid.addEventListener("click", (e) => {
            const editBtn = e.target.closest(".category-edit-btn");
            if (editBtn) {
                const id = editBtn.getAttribute("data-id");
                const name = editBtn.getAttribute("data-name");
                const icon = editBtn.getAttribute("data-icon");
                openModal({ id: parseInt(id), name, icon });
                return;
            }
            const deleteBtn = e.target.closest(".category-delete-btn");
            if (deleteBtn) {
                const id = deleteBtn.getAttribute("data-id");
                confirmDelete(parseInt(id), deleteBtn);
            }
        });
    }

});

// ======================================
// State
// ======================================

let allCategories = [];
let editingCategoryId = null;

// ======================================
// Load Categories
// ======================================

async function loadCategories() {

    try {

        const response = await fetchWithAuth(`${API_BASE_URL}/api/categories/`);

        if (!response.ok) {
            const msg = await extractErrorMessage(new Error("Failed to load categories"), response);
            if (typeof showToast === "function") {
                showToast(msg, "error");
            }
            return;
        }

        allCategories = await response.json();

        renderCategories(allCategories);

    } catch (error) {

        console.error(error);
        const msg = await extractErrorMessage(error, null);
        if (typeof showToast === "function") {
            showToast(msg, "error");
        }

    }

}

// ======================================
// Render Categories
// ======================================

function renderCategories(categories) {

    const grid = document.getElementById("categories-grid");

    if (!grid) return;

    grid.innerHTML = "";

    if (!categories || categories.length === 0) {

        grid.innerHTML = `<div class="category-card" style="grid-column:1/-1;"><p style="text-align:center;color:#6B7280;">No categories found.</p></div>`;

        return;

    }

    categories.forEach(cat => {

        // XSS fix: use escapeHtml() for dynamic values that come from the
        // user/API. Icons can be arbitrary text, names come from the DB.
        const icon = escapeHtml(cat.icon || "📦");
        const name = escapeHtml(cat.name ?? "Unknown");
        const count = Number(cat.expense_count) || 0;

        const card = document.createElement("div");
        card.className = "category-card";
        card.setAttribute("data-name", (cat.name ? String(cat.name) : "unknown").toLowerCase());

        card.innerHTML = `
            <div class="category-icon">${icon}</div>
            <h3>${name}</h3>
            <p>${count} Expenses</p>
            <div class="category-card-actions">
                <button class="category-edit-btn" data-id="${cat.id}" data-name="${encodeURIComponent(cat.name || "")}" data-icon="${encodeURIComponent(cat.icon || "")}">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button class="category-delete-btn" data-id="${cat.id}">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </div>
        `;

        grid.appendChild(card);

    });

}

// ======================================
// Search / Filter
// ======================================

function filterCategories() {

    const searchInput = document.getElementById("category-search");
    if (!searchInput) return;

    const query = searchInput.value.toLowerCase().trim();

    if (!query) {

        renderCategories(allCategories);
        return;

    }

    const filtered = allCategories.filter(cat =>
        cat.name && cat.name.toLowerCase().includes(query)
    );

    renderCategories(filtered);

}

// ======================================
// Modal
// ======================================

function openModal(category) {

    const overlay = document.getElementById("category-modal-overlay");
    const title = document.getElementById("modal-title");
    const nameInput = document.getElementById("modal-category-name");
    const iconInput = document.getElementById("modal-category-icon");

    if (category) {

        // Edit mode
        editingCategoryId = category.id;
        title.textContent = "Edit Category";
        nameInput.value = category.name || "";
        iconInput.value = category.icon || "";

    } else {

        // Add mode
        editingCategoryId = null;
        title.textContent = "Add Category";
        nameInput.value = "";
        iconInput.value = "";

    }

    overlay.classList.add("active");
    nameInput.focus();

}

function closeModal() {

    const overlay = document.getElementById("category-modal-overlay");
    overlay.classList.remove("active");
    editingCategoryId = null;

}

// ======================================
// Save Category (Add / Update)
// ======================================

async function saveCategory() {

    const saveBtn = document.getElementById("modal-save-btn");
    const nameInput = document.getElementById("modal-category-name");
    const iconInput = document.getElementById("modal-category-icon");

    if (!nameInput) return;
    if (saveBtn && saveBtn.disabled) return; // Prevent duplicate requests

    const name = nameInput.value.trim();
    const icon = iconInput ? iconInput.value.trim() : "";

    if (!name) {

        if (typeof showToast === "function") {
            showToast("Category name is required.", "warning");
        } else {
            alert("Category name is required.");
        }
        nameInput.focus();
        return;

    }

    if (saveBtn) {
        setButtonLoading(saveBtn, true, "Saving...");
    }

    try {

        if (editingCategoryId) {

            // UPDATE
            const response = await fetchWithAuth(`${API_BASE_URL}/api/categories/${editingCategoryId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, icon }),
            });

            if (!response.ok) {
                const msg = await extractErrorMessage(new Error("Update failed"), response);
                if (typeof showToast === "function") {
                    showToast(msg, "error");
                }
                return;
            }

            if (typeof showToast === "function") {
                showToast("Category updated successfully!", "success");
            }

        } else {

            // CREATE
            const response = await fetchWithAuth(`${API_BASE_URL}/api/categories/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, icon }),
            });

            if (!response.ok) {
                const msg = await extractErrorMessage(new Error("Add failed"), response);
                if (typeof showToast === "function") {
                    showToast(msg, "error");
                }
                return;
            }

            if (typeof showToast === "function") {
                showToast("Category added successfully!", "success");
            }

        }

        closeModal();
        await loadCategories();

    } catch (error) {

        const msg = await extractErrorMessage(error, null);
        if (typeof showToast === "function") {
            showToast(msg, "error");
        } else {
            alert(msg);
        }
        console.error(error);

    } finally {
        if (saveBtn) {
            setButtonLoading(saveBtn, false);
        }
    }

}

// ======================================
// Delete Category
// ======================================

async function confirmDelete(id, button) {

    let confirmed = false;

    if (typeof showConfirmModal === "function") {
        confirmed = await showConfirmModal({
            title: "Delete Category",
            message: "Are you sure you want to delete this category? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            icon: "danger",
            confirmClass: "modal-confirm-btn-confirm"
        });
    } else {
        confirmed = confirm("Are you sure you want to delete this category?");
    }

    if (!confirmed) return;

    // Show a spinner on the clicked delete button after confirmation
    let originalHTML = "";
    if (button) {
        originalHTML = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span class="button-spinner"></span>';
    }

    try {

        const response = await fetchWithAuth(`${API_BASE_URL}/api/categories/${id}`, {
            method: "DELETE"
        });

        if (!response.ok) {
            const msg = await extractErrorMessage(new Error("Delete failed"), response);
            if (typeof showToast === "function") {
                showToast(msg, "error");
            }
            return;
        }

        if (typeof showToast === "function") {
            showToast("Category deleted successfully!", "success");
        }

        await loadCategories();

    } catch (error) {

        const msg = await extractErrorMessage(error, null);
        if (typeof showToast === "function") {
            showToast(msg, "error");
        } else {
            alert(msg);
        }
        console.error(error);

    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalHTML;
        }
    }

}
