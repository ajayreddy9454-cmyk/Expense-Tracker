// ======================================
// Expense Tracker
// Budget Page Script
// ======================================

document.addEventListener("DOMContentLoaded", () => {

    if (!authGuard()) return;

    loadBudgets();
    loadCategoryDropdown();

    // Add Budget button
    document.querySelector(".add-budget-btn").addEventListener("click", () => {
        openBudgetModal(null);
    });

    // Modal close
    document.getElementById("budget-modal-close-btn").addEventListener("click", closeBudgetModal);
    document.getElementById("budget-modal-cancel-btn").addEventListener("click", closeBudgetModal);
    document.getElementById("budget-modal-overlay").addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closeBudgetModal();
    });

    // Save button
    document.getElementById("budget-modal-save-btn").addEventListener("click", saveBudget);

});

// ======================================
// State
// ======================================

let allCategories = [];
let editingBudgetId = null;

// ======================================
// Load Budgets from API
// ======================================

async function loadBudgets() {

    try {

        const response = await fetch("http://127.0.0.1:5000/api/budgets/", {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error("Failed to fetch budgets");

        const budgets = await response.json();

        renderBudgetCards(budgets);

    } catch (error) {

        console.error("Failed to load budgets:", error);

    }

}

// ======================================
// Load Categories for Dropdown
// ======================================

async function loadCategoryDropdown() {

    try {

        const response = await fetch("http://127.0.0.1:5000/api/categories/", {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error("Failed to fetch categories");

        allCategories = await response.json();

        const select = document.getElementById("budget-modal-category");

        select.innerHTML = '<option value="">-- Select Category --</option>';

        allCategories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.id;
            option.textContent = cat.icon ? `${cat.icon} ${cat.name}` : cat.name;
            select.appendChild(option);
        });

    } catch (error) {

        console.error("Failed to load categories:", error);

    }

}

// ======================================
// Render Budget Cards
// ======================================

function renderBudgetCards(budgets) {

    const grid = document.getElementById("budgetGrid");

    if (!grid) return;

    grid.innerHTML = "";

    if (!Array.isArray(budgets) || budgets.length === 0) {

        grid.innerHTML = `

            <div class="budget-card" style="grid-column: 1 / -1; text-align: center;">

                <p style="font-size: 18px; color: #6B7280; padding: 40px 0;">

                    No budgets found. Click "Add Budget" to create one.

                </p>

            </div>

        `;

        return;

    }

    budgets.forEach(budget => {

        const icon = budget.category_icon || "📦";

        const name = budget.category_name || "Unknown";

        const budgetAmount = Number(budget.budget_amount) || 0;

        const spentAmount = Number(budget.spent_amount) || 0;

        const remainingAmount = Number(budget.remaining_amount) || 0;

        // Calculate progress percentage, cap at 100%
        let progressPercent = 0;

        if (budgetAmount > 0) {

            progressPercent = Math.min((spentAmount / budgetAmount) * 100, 100);

        }

        // Determine progress bar color based on spending ratio
        const ratio = budgetAmount > 0 ? spentAmount / budgetAmount : 0;

        let barColor = "#22C55E";  // green (under 50%)

        if (ratio >= 0.5 && ratio < 0.8) {

            barColor = "#3B82F6";  // blue (50-80%)

        } else if (ratio >= 0.8 && ratio <= 1.0) {

            barColor = "#F59E0B";  // orange (80-100%)

        } else if (ratio > 1.0) {

            barColor = "#EF4444";  // red (over budget)
        }

        const card = document.createElement("div");

        card.className = "budget-card";

        card.innerHTML = `

            <div class="budget-top">

                <h3>${icon} ${name}</h3>

                <span>₹${budgetAmount.toLocaleString()}</span>

            </div>

            <div class="progress-bar">

                <div class="progress" style="width: ${progressPercent}%; background: ${barColor};"></div>

            </div>

            <div class="budget-info">

                <span>Spent: ₹${spentAmount.toLocaleString()}</span>

                <span>Remaining: ₹${remainingAmount.toLocaleString()}</span>

            </div>

            <div style="display:flex; gap:10px; margin-top:15px; justify-content:center;">

                <button class="budget-edit-btn" data-id="${budget.id}" data-category-id="${budget.category_id}" data-amount="${budgetAmount}" data-month="${budget.month || ''}" data-year="${budget.year || ''}" style="padding:6px 14px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;background:#EEF2FF;color:#6366F1;">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button class="budget-delete-btn" data-id="${budget.id}" style="padding:6px 14px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;background:#FEF2F2;color:#EF4444;">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>

            </div>

        `;

        grid.appendChild(card);

    });

    // Attach event listeners to edit buttons
    document.querySelectorAll(".budget-edit-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = parseInt(btn.getAttribute("data-id"));
            const categoryId = parseInt(btn.getAttribute("data-category-id"));
            const amount = parseFloat(btn.getAttribute("data-amount"));
            const month = btn.getAttribute("data-month");
            const year = btn.getAttribute("data-year");
            openBudgetModal({ id, category_id: categoryId, budget_amount: amount, month, year });
        });
    });

    // Attach event listeners to delete buttons
    document.querySelectorAll(".budget-delete-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = parseInt(btn.getAttribute("data-id"));
            confirmDeleteBudget(id);
        });
    });

}

// ======================================
// Budget Modal
// ======================================

function openBudgetModal(budget) {

    const overlay = document.getElementById("budget-modal-overlay");
    const title = document.getElementById("budget-modal-title");
    const categorySelect = document.getElementById("budget-modal-category");
    const amountInput = document.getElementById("budget-modal-amount");
    const monthSelect = document.getElementById("budget-modal-month");
    const yearInput = document.getElementById("budget-modal-year");

    if (budget) {

        // Edit mode
        editingBudgetId = budget.id;
        title.textContent = "Edit Budget";
        categorySelect.value = budget.category_id || "";
        amountInput.value = budget.budget_amount || "";
        monthSelect.value = budget.month || "";
        yearInput.value = budget.year || "";

    } else {

        // Add mode
        editingBudgetId = null;
        title.textContent = "Add Budget";
        categorySelect.value = "";
        amountInput.value = "";
        monthSelect.value = "";
        yearInput.value = "";

    }

    overlay.classList.add("active");

}

function closeBudgetModal() {

    const overlay = document.getElementById("budget-modal-overlay");
    overlay.classList.remove("active");
    editingBudgetId = null;

}

// ======================================
// Save Budget (Add / Update)
// ======================================

async function saveBudget() {

    const categorySelect = document.getElementById("budget-modal-category");
    const amountInput = document.getElementById("budget-modal-amount");
    const monthSelect = document.getElementById("budget-modal-month");
    const yearInput = document.getElementById("budget-modal-year");

    const category_id = parseInt(categorySelect.value);
    const amount = parseFloat(amountInput.value);
    const month = monthSelect.value;
    const year = parseInt(yearInput.value);

    if (!category_id) {
        if (typeof showToast === "function") {
            showToast("Please select a category.", "warning");
        } else {
            alert("Please select a category.");
        }
        categorySelect.focus();
        return;
    }

    if (!amount || amount <= 0) {
        if (typeof showToast === "function") {
            showToast("Please enter a valid budget amount.", "warning");
        } else {
            alert("Please enter a valid budget amount.");
        }
        amountInput.focus();
        return;
    }

    try {

        if (editingBudgetId) {

            // UPDATE
            const response = await fetch(`http://127.0.0.1:5000/api/budgets/${editingBudgetId}`, {
                method: "PUT",
                headers: Object.assign({ "Content-Type": "application/json" }, getAuthHeaders()),
                body: JSON.stringify({ category_id, amount, month, year }),
            });

            if (!response.ok) {
                const msg = await extractErrorMessage(new Error("Update failed"), response);
                if (typeof showToast === "function") {
                    showToast(msg, "error");
                }
                return;
            }

            if (typeof showToast === "function") {
                showToast("Budget updated successfully!", "success");
            }

        } else {

            // CREATE
            const response = await fetch("http://127.0.0.1:5000/api/budgets/", {
                method: "POST",
                headers: Object.assign({ "Content-Type": "application/json" }, getAuthHeaders()),
                body: JSON.stringify({ category_id, amount, month, year }),
            });

            if (!response.ok) {
                const msg = await extractErrorMessage(new Error("Add failed"), response);
                if (typeof showToast === "function") {
                    showToast(msg, "error");
                }
                return;
            }

            if (typeof showToast === "function") {
                showToast("Budget added successfully!", "success");
            }

        }

        closeBudgetModal();
        await loadBudgets();

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
// Delete Budget
// ======================================

async function confirmDeleteBudget(id) {

    let confirmed = false;

    if (typeof showConfirmModal === "function") {
        confirmed = await showConfirmModal({
            title: "Delete Budget",
            message: "Are you sure you want to delete this budget? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            icon: "danger",
            confirmClass: "modal-confirm-btn-confirm"
        });
    } else {
        confirmed = confirm("Are you sure you want to delete this budget?");
    }

    if (!confirmed) return;

    try {

const response = await fetch(`http://127.0.0.1:5000/api/budgets/${id}`, {
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
            showToast("Budget deleted successfully!", "success");
        }

        await loadBudgets();

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

