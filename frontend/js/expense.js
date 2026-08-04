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

    // If on expenses.html page, load categories for filter.
    // Load the category filter and the expense list in parallel since they
    // are independent requests — this removes a full network round-trip from
    // startup.
    if (document.querySelector(".expense-filters")) {
        await Promise.all([loadCategoryFilter(), refreshExpenses()]);
        setupFilters();
        loadExpenses();
    } else if (document.querySelector(".expense-table")) {
        // Only fetch the expense list when a table exists on this page.
        // On add_expense.html (no table) this avoids a redundant network call.
        await refreshExpenses();
        loadExpenses();
    }

    // Edit flow: add_expense.html?editId=<id>
    const url = new URL(window.location.href);
    const editId = url.searchParams.get("editId");
    if (editId) {
        const idNum = Number(editId);
        url.searchParams.delete("editId");
        window.history.replaceState({}, "", url.toString());

        await tryBeginEditFromId(idNum);
    }
});

// ======================================
// Backend API
// ======================================

async function refreshExpenses() {
    try {
        const res = await fetchWithAuth(EXPENSES_API_URL, { method: "GET" });

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
        const res = await fetchWithAuth(`${API_BASE_URL}/api/categories/`);
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

                res = await fetchWithAuth(endpoint, {
                    method,
                    body: formData
                });
            } else {
                // Send JSON (no file) — simpler, avoids CORS/form-data issues on Render
                res = await fetchWithAuth(endpoint, {
                    method,
                    headers: { "Content-Type": "application/json" },
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
// Shared Row Builder
// ======================================

function buildExpenseRowHtml(expense) {
    const categoryName = expense.category_name || categoryMap[expense.category_id] || "Uncategorized";
    const hasNotes = expense.notes && String(expense.notes).trim() !== "";
    const receiptHtml = expense.receipt
        ? `<a class="receipt-link" href="${API_BASE_URL}/static/uploads/${encodeURIComponent(expense.receipt)}" target="_blank" rel="noopener">View Receipt</a>`
        : "No Receipt";

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
                    ${hasNotes ? `<button class="notes-btn" data-id="${expense.id}" title="View Notes"><i class="fa-solid fa-note-sticky"></i></button>` : ""}
                    ${receiptHtml}
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

    const rows = expenses.map(expense => buildExpenseRowHtml(expense));
    tableBody.innerHTML = rows.join("");

    // Delegate "View Notes" clicks after render (single shared handler below).
    attachNotesButtonHandler();
}

// ======================================
// Notes Modal
// ======================================

function showNotesModal(notes) {
    // Create a lightweight modal for viewing notes
    const overlay = document.createElement("div");
    overlay.className = "modal-confirm-overlay notes-view";
    overlay.innerHTML = `
        <div class="modal-confirm">
            <div class="modal-confirm-header">
                <div class="modal-confirm-icon info-icon">
                    <i class="fa-solid fa-note-sticky"></i>
                </div>
                <h3 class="modal-confirm-title">Expense Notes</h3>
            </div>
            <div class="modal-confirm-body">
                <p class="notes-view-text">${escapeHtml(notes || "No notes added.")}</p>
            </div>
            <div class="modal-confirm-footer">
                <button class="modal-confirm-btn modal-confirm-btn-cancel" id="notesModalClose">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Ensure the overlay is active/animated
    requestAnimationFrame(() => overlay.classList.add("active"));

    const closeBtn = overlay.querySelector("#notesModalClose");

    function closeNotesModal() {
        overlay.classList.remove("active");
        document.removeEventListener("keydown", escHandler);
        setTimeout(() => {
            if (overlay.parentElement) {
                overlay.parentElement.removeChild(overlay);
            }
        }, 250);
    }

    closeBtn.addEventListener("click", closeNotesModal);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeNotesModal();
    });

    function escHandler(e) {
        if (e.key === "Escape") closeNotesModal();
    }
    document.addEventListener("keydown", escHandler);
}

// Attach notes-button click handlers (single delegation per render)
function attachNotesButtonHandler() {
    document.querySelectorAll(".notes-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = Number(btn.getAttribute("data-id"));
            const expense = expenses.find(x => x.id === id);
            if (expense) {
                showNotesModal(expense.notes || "No notes added.");
            }
        });
    });
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
        const res = await fetchWithAuth(`${EXPENSES_API_URL}${id}`, {
            method: "DELETE"
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
        const res = await fetchWithAuth(`${API_BASE_URL}/api/categories/`);
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
    const searchInput = document.getElementById("expense-search");
    const categorySelect = document.getElementById("expense-category");
    const dateInput = document.getElementById("expense-date");

    const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const categoryValue = categorySelect ? categorySelect.value : "";
    const dateValue = dateInput ? dateInput.value : "";

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

    const rows = filteredExpenses.map(expense => buildExpenseRowHtml(expense));
    tableBody.innerHTML = rows.join("");

    attachNotesButtonHandler();
}
