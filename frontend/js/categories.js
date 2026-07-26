// ======================================
// Expense Tracker
// Categories Script
// ======================================

document.addEventListener("DOMContentLoaded", () => {

    // Auth guard first
    if (!authGuard()) return;

    loadCategories();

    // Add Category button
    document.getElementById("add-category-btn").addEventListener("click", () => {
        openModal(null);
    });

    // Modal close
    document.getElementById("modal-close-btn").addEventListener("click", closeModal);
    document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);
    document.getElementById("category-modal-overlay").addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    // Save button
    document.getElementById("modal-save-btn").addEventListener("click", saveCategory);

    // Search
    document.getElementById("category-search").addEventListener("input", filterCategories);

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

        const response = await fetch("http://127.0.0.1:5000/api/categories/", {
            headers: getAuthHeaders()
        });

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

        const icon = cat.icon || "📦";
        const name = cat.name ?? "Unknown";

        const card = document.createElement("div");
        card.className = "category-card";
        card.setAttribute("data-name", name.toLowerCase());

        card.innerHTML = `
            <div class="category-icon">${icon}</div>
            <h3>${name}</h3>
            <p>${cat.expense_count ?? 0} Expenses</p>
            <div class="category-card-actions">
                <button class="category-edit-btn" data-id="${cat.id}" data-name="${name}" data-icon="${icon}">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button class="category-delete-btn" data-id="${cat.id}">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </div>
        `;

        grid.appendChild(card);

    });

    // Attach event listeners to edit buttons
    document.querySelectorAll(".category-edit-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = btn.getAttribute("data-id");
            const name = btn.getAttribute("data-name");
            const icon = btn.getAttribute("data-icon");
            openModal({ id: parseInt(id), name, icon });
        });
    });

    // Attach event listeners to delete buttons
    document.querySelectorAll(".category-delete-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = btn.getAttribute("data-id");
            confirmDelete(parseInt(id));
        });
    });

}

// ======================================
// Search / Filter
// ======================================

function filterCategories() {

    const query = document.getElementById("category-search").value.toLowerCase().trim();

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

    const nameInput = document.getElementById("modal-category-name");
    const iconInput = document.getElementById("modal-category-icon");

    const name = nameInput.value.trim();
    const icon = iconInput.value.trim();

if (!name) {

        if (typeof showToast === "function") {
            showToast("Category name is required.", "warning");
        } else {
            alert("Category name is required.");
        }
        nameInput.focus();
        return;

    }

    try {

        if (editingCategoryId) {

            // UPDATE
            const response = await fetch(`http://127.0.0.1:5000/api/categories/${editingCategoryId}`, {
                method: "PUT",
                headers: Object.assign({ "Content-Type": "application/json" }, getAuthHeaders()),
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
            const response = await fetch("http://127.0.0.1:5000/api/categories/", {
                method: "POST",
                headers: Object.assign({ "Content-Type": "application/json" }, getAuthHeaders()),
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

    }

}

// ======================================
// Delete Category
// ======================================

async function confirmDelete(id) {

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

    try {

const response = await fetch(`http://127.0.0.1:5000/api/categories/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders()
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

    }

}

