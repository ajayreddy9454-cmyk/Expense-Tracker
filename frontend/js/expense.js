// ======================================
// Expense Tracker
// Expense Management
// ======================================

let expenses = [];
let editingExpenseId = null;
let categoryMap = {};

const EXPENSES_API_URL = `${API_BASE_URL}/api/expenses/`;

document.addEventListener("DOMContentLoaded", async () => {
    // Auth guard
    if (!authGuard()) return;

    // Only run category dropdown and form init on add_expense.html
    if (document.querySelector(".expense-grid")) {
        await loadCategoriesDropdown();
        initializeExpenseForm();
    }

    // If on expenses.html page, load categories for filter and setup filtering
    if (document.querySelector(".expense-filters")) {
        await loadCategoryFilter();
        setupFilters();
    }

    // Edit flow: add_expense.html?editId=<id>
    const url = new URL(window.location.href);
    const editId = url.searchParams.get("editId");
    if (editId) {
        const idNum = Number(editId);
        url.searchParams.delete("editId");
        window.history.replaceState({}, "", url.toString());

        await tryBeginEditFromId(idNum);
    } else if (document.querySelector(".expense-table")) {
        // Only fetch the expense list when a table exists on this page.
        // On add_expense.html (no table) this avoids a redundant network call.
        await refreshExpenses();
        loadExpenses();
    }
});

// ======================================
// Backend API
// ======================================

async function refreshExpenses() {
    try {
        const res = await fetchWithTimeout(EXPENSES_API_URL, {
            method: "GET",
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            const msg = await extractErrorMessage(new Error("Failed to load expenses"), res);
            throw new Error(msg);
        }

        expenses = await res.json();
    } catch (error) {
        console.error("refreshExpenses failed:", error);
        // Keep existing expenses on failure rather than wiping the table
        if (!Array.isArray(expenses)) {
            expenses = [];
        }
        const msg = await extractErrorMessage(error, null);
        if (typeof showToast === "function") {
            showToast(msg, "error");
        }
    }
}

// ======================================
// Load Categories Dropdown
// ======================================

async function loadCategoriesDropdown() {
    const select = document.querySelector(".expense-grid select");
    if (!select) return;

    try {
        const res = await fetchWithTimeout(`${API_BASE_URL}/api/categories/`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error("Failed to load categories");

        const categories = await res.json();

        // Remove all existing options
        select.innerHTML = "";

        // Add default option
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Select a category";
        select.appendChild(defaultOption);

        // Populate from API
        categories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error(error);
    }
}

// ======================================
// Add/Edit Expense form
// ======================================

function initializeExpenseForm() {
    const form = document.querySelector(".expense-grid");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn && submitBtn.disabled) return;

        // Cache DOM lookups for the duration of this submit
        const titleInput = form.querySelector('input[type="text"]');
        const amountInput = form.querySelector('input[type="number"]');
        const allSelects = form.querySelectorAll("select");
        const categorySelect = allSelects[0];
        const paymentMethodSelect = allSelects[1];
        const dateInput = form.querySelector('input[type="date"]');
        const textarea = form.querySelector("textarea");
        const receiptInput = form.querySelector('input[type="file"]');

        try {
            const title = titleInput ? titleInput.value.trim() : "";
            const amountStr = amountInput ? amountInput.value : "";
            const category = categorySelect ? categorySelect.value : "";
            const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : "Cash";
            const date = dateInput ? dateInput.value : "";
            const notes = textarea ? textarea.value : "";

            if (title === "" || amountStr === "" || date === "") {
                if (typeof showToast === "function") {
                    showToast("Please fill all required fields.", "warning");
                } else {
                    alert("Please fill all required fields.");
                }
                return;
            }

            const payload = {
                category_id: Number(category),
                title,
                amount: Number(amountStr),
                payment_method: paymentMethod,
                expense_date: date,
                notes
            };

            const isEditing = editingExpenseId !== null;
            const endpoint = isEditing ? `${EXPENSES_API_URL}${editingExpenseId}` : EXPENSES_API_URL;
            const method = isEditing ? "PUT" : "POST";

        const file =
            receiptInput && receiptInput.files && receiptInput.files.length > 0
                ? receiptInput.files[0]
                : null;

            // Show loading state on submit button
            if (submitBtn) {
                setButtonLoading(submitBtn, true, isEditing ? "Updating..." : "Saving...");
            }

            let res;
            if (file) {
                // Send FormData (for file uploads) — browser auto-sets Content-Type
                const formData = new FormData();
                formData.append("category_id", payload.category_id);
                formData.append("title", payload.title);
                formData.append("amount", payload.amount);
                formData.append("payment_method", payload.payment_method);
                formData.append("expense_date", payload.expense_date);
                formData.append("notes", payload.notes);
                formData.append("receipt", file);

                res = await fetchWithTimeout(endpoint, {
                    method,
                    headers: getAuthHeaders(),  // No Content-Type — browser sets multipart boundary
                    body: formData
                });
            } else {
                // Send JSON (no file) — simpler, avoids CORS/form-data issues on Render
                res = await fetchWithTimeout(endpoint, {
                    method,
                    headers: getAuthHeaders("application/json"),
                    body: JSON.stringify(payload)
                });
            }

            if (!res.ok) {
                const msg = await extractErrorMessage(new Error("Save failed"), res);
                if (typeof showToast === "function") {
                    showToast(msg, "error");
                }
                return;
            }

            if (typeof showToast === "function") {
                showToast(isEditing ? "Expense updated successfully!" : "Expense added successfully!", "success");
            } else {
                alert(isEditing ? "Expense updated successfully!" : "Expense added successfully!");
            }

            // Clear form + exit edit mode
            form.reset();
            editingExpenseId = null;
            updateSubmitLabel();

            // Refresh the expense list only when a table exists on this page.
            // On add_expense.html (no table) this avoids a redundant network call
            // immediately after every save.
            if (document.querySelector(".expense-table")) {
                await refreshExpenses();
                loadExpenses();
            }
        } catch (error) {
            console.error(error);
            const msg = await extractErrorMessage(error, null);
            if (typeof showToast === "function") {
                showToast(msg, "error");
            } else {
                alert(msg);
            }
        } finally {
            // Restore button (also covers the early "required fields" return path).
            // setButtonLoading(false) restores the original label automatically.
            if (submitBtn) {
                setButtonLoading(submitBtn, false);
            }
        }
    });
}

function updateSubmitLabel() {
    const form = document.querySelector(".expense-grid");
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    submitBtn.textContent = editingExpenseId !== null ? "Update Expense" : "Save Expense";
}

// ======================================
// View Expenses table
// ======================================

function loadExpenses() {
    const tableBody = document.querySelector(".expense-table tbody");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (!expenses || expenses.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">No expenses found.</td>
            </tr>
        `;
        return;
    }

    const rows = expenses.map(expense => {
        const categoryName = expense.category_name || categoryMap[expense.category_id] || "Uncategorized";
        return `
            <tr>
                <td>${escapeHtml(expense.title || "")}</td>
                <td>${escapeHtml(categoryName)}</td>
                <td>${escapeHtml(expense.expense_date || "")}</td>
                <td>Rs.${Number(expense.amount || 0).toLocaleString()}</td>
                <td>
                    <span class="completed">Completed</span>
                </td>
                <td>
                    <div class="expense-actions" style="display:flex; gap:8px; align-items:center;">
                        ${expense.receipt ? `<a href="${API_BASE_URL}/static/uploads/${escapeHtml(expense.receipt)}" target="_blank" rel="noopener">View Receipt</a>` : 'No Receipt'}
                        <button class="edit-btn" onclick="editExpense(${expense.id})">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="delete-btn" onclick="deleteExpense(${expense.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = rows.join("");
}

// ======================================
// Edit logic
// ======================================

async function tryBeginEditFromId(id) {
    // Ensure we have the expense list.
    if (!expenses || !expenses.length) {
        await refreshExpenses();
    }

    const expense = expenses.find(e => e.id === id);
    if (!expense) {
        if (typeof showToast === "function") {
            showToast("Expense not found", "error");
        } else {
            alert("Expense not found");
        }
        return;
    }

    const form = document.querySelector(".expense-grid");
    if (!form) {
        // If user is on expenses.html (no form), go to add_expense.html to populate.
        window.location.href = `add_expense.html?editId=${id}`;
        return;
    }

    editingExpenseId = id;

    const titleInput = form.querySelector('input[type="text"]');
    const amountInput = form.querySelector('input[type="number"]');
    const categorySelect = form.querySelector("select");
    const dateInput = form.querySelector('input[type="date"]');
    const textarea = form.querySelector("textarea");

    if (titleInput) titleInput.value = expense.title ?? "";
    if (amountInput) amountInput.value = expense.amount ?? "";

    if (categorySelect) {
        const target = String(expense.category_id);
        // match by option value or text
        Array.from(categorySelect.options).forEach(opt => {
            if (String(opt.value) === target || String(opt.text) === target) {
                categorySelect.value = opt.value;
            }
        });
    }

    if (dateInput) dateInput.value = expense.expense_date ?? "";
    if (textarea) textarea.value = expense.notes ?? "";

    updateSubmitLabel();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editExpense(id) {
    // Called from expenses table buttons
    tryBeginEditFromId(id);
}

window.editExpense = editExpense;

// ======================================
// Delete Expense
// ======================================

async function deleteExpense(id) {
    let confirmed = false;

    if (typeof showConfirmModal === "function") {
        confirmed = await showConfirmModal({
            title: "Delete Expense",
            message: "Are you sure you want to delete this expense? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            icon: "danger",
            confirmClass: "modal-confirm-btn-confirm"
        });
    } else {
        confirmed = confirm("Delete this expense?");
    }

    if (!confirmed) return;

    try {
        const res = await fetchWithTimeout(`${EXPENSES_API_URL}${id}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            const errText = await extractErrorMessage(new Error("Failed to delete expense"), res);
            throw new Error(errText);
        }

        if (typeof showToast === "function") {
            showToast("Expense deleted successfully!", "success");
        }
        await refreshExpenses();
        loadExpenses();
    } catch (err) {
        console.error("Delete expense error:", err);
        const msg = await extractErrorMessage(err, null);
        if (typeof showToast === "function") {
            showToast(msg, "error");
        } else {
            alert(msg);
        }
    }
}

window.deleteExpense = deleteExpense;

// ======================================
// Category Filter — Load from API
// ======================================

async function loadCategoryFilter() {
    const select = document.getElementById("expense-category");
    if (!select) return;

    try {
        const res = await fetchWithTimeout(`${API_BASE_URL}/api/categories/`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error("Failed to load categories");

        const categories = await res.json();

        // Build a lookup map: category_id -> category_name
        categoryMap = {};
        categories.forEach(cat => {
            categoryMap[cat.id] = cat.name;
        });

        // Populate filter dropdown
        select.innerHTML = '<option value="">All Categories</option>';
        categories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Failed to load category filter:", error);
    }
}

// ======================================
// Live Filtering — Run on every change
// ======================================

function setupFilters() {
    const searchInput = document.getElementById("expense-search");
    const categorySelect = document.getElementById("expense-category");
    const dateInput = document.getElementById("expense-date");

    if (searchInput) {
        searchInput.addEventListener("input", filterExpenses);
    }
    if (categorySelect) {
        categorySelect.addEventListener("change", filterExpenses);
    }
    if (dateInput) {
        dateInput.addEventListener("change", filterExpenses);
    }
}

function filterExpenses() {
    const searchValue = document.getElementById("expense-search")?.value?.toLowerCase().trim() || "";
    const categoryValue = document.getElementById("expense-category")?.value || "";
    const dateValue = document.getElementById("expense-date")?.value || "";

    // Start with all expenses
    let filtered = expenses;

    // Filter by title (case-insensitive, partial match)
    if (searchValue) {
        filtered = filtered.filter(exp =>
            exp.title && exp.title.toLowerCase().includes(searchValue)
        );
    }

    // Filter by category
    if (categoryValue) {
        filtered = filtered.filter(exp =>
            String(exp.category_id) === categoryValue
        );
    }

    // Filter by date
    if (dateValue) {
        filtered = filtered.filter(exp =>
            exp.expense_date === dateValue
        );
    }

    // Re-render the table with filtered data
    renderFilteredExpenses(filtered);
}

function renderFilteredExpenses(filteredExpenses) {
    const tableBody = document.querySelector(".expense-table tbody");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (!filteredExpenses || filteredExpenses.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">No expenses match your filters.</td>
            </tr>
        `;
        return;
    }

    const rows = filteredExpenses.map(expense => {
        const categoryName = expense.category_name || categoryMap[expense.category_id] || "Uncategorized";
        return `
            <tr>
                <td>${escapeHtml(expense.title || "")}</td>
                <td>${escapeHtml(categoryName)}</td>
                <td>${escapeHtml(expense.expense_date || "")}</td>
                <td>Rs.${Number(expense.amount || 0).toLocaleString()}</td>
                <td>
                    <span class="completed">Completed</span>
                </td>
                <td>
                    <div class="expense-actions" style="display:flex; gap:8px; align-items:center;">
                        ${expense.receipt ? `<a href="${API_BASE_URL}/static/uploads/${escapeHtml(expense.receipt)}" target="_blank" rel="noopener">View Receipt</a>` : 'No Receipt'}
                        <button class="edit-btn" onclick="editExpense(${expense.id})">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="delete-btn" onclick="deleteExpense(${expense.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = rows.join("");
}

