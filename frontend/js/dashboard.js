// ======================================
// Expense Tracker
// Dashboard Script
// ======================================

document.addEventListener("DOMContentLoaded", () => {

    // Auth guard first
    if (!authGuard()) return;

    setCurrentDate();
    setWelcomeUserName();
    loadDashboard();

});

// ======================================
// Set Current Date (replaces hard-coded date)
// ======================================

function setCurrentDate() {
    const el = document.getElementById("currentDate");
    if (!el) return;

    const now = new Date();
    const options = { day: "numeric", month: "long", year: "numeric" };
    el.textContent = now.toLocaleDateString("en-GB", options).replace(/ /g, " ");
}

// ======================================
// Set Welcome User Name (time-based greeting + first name only)
// ======================================

function setWelcomeUserName() {
    const el = document.getElementById("welcomeUserName");
    if (!el) return;

    // Time-based greeting
    const hour = new Date().getHours();
    let greeting = "Good Evening";
    if (hour < 12) {
        greeting = "Good Morning";
    } else if (hour < 17) {
        greeting = "Good Afternoon";
    }

    // Extract first name only
    let firstName = "User";
    const user = getCurrentUser();
    if (user) {
        const fullName = user.full_name || user.name || "";
        if (fullName) {
            firstName = fullName.trim().split(/\s+/)[0];
        }
    }

    // Update the h1 text: "Good Morning, Vijay 👋"
    const h1 = el.closest("h1");
    if (h1) {
        const textNode = h1.childNodes[0];
        if (textNode) {
            textNode.textContent = greeting + ", ";
        }
    }
    el.textContent = firstName + " 👋";
}

// ======================================
// Load Dashboard
// ======================================

async function loadDashboard() {
    const apiData = await fetchDashboardSummary();

    if (!apiData) return;

    updateTotalExpensesCard(apiData.total_expenses);
    updateTotalAmountSpentCard(apiData.total_expense_amount);
    updateThisMonthExpensesCard(apiData.this_month_expenses);
    updateCategoriesUsedCard(apiData.categories_used);
    loadTopCategories(apiData.top_categories);
    loadRecentTransactions(apiData.recent_expenses);
}

// ======================================
// Fetch Dashboard Data
// ======================================

async function fetchDashboardSummary() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/dashboard/`);

        if (!response.ok) {
            const msg = await extractErrorMessage(new Error("Failed to load dashboard"), response);
            if (typeof showToast === "function") {
                showToast(msg, "error");
            }
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error(error);
        const msg = await extractErrorMessage(error, null);
        if (typeof showToast === "function") {
            showToast(msg, "error");
        }
        return null;
    } finally {
        // No loading indicator to clear here; cards fall back to placeholder text
    }
}

// ======================================
// Update Card 1 – Total Expenses
// ======================================

function updateTotalExpensesCard(count) {
    const el = document.getElementById("total-expenses-value");
    if (el) {
        el.textContent = Number(count || 0).toLocaleString();
    }
}

// ======================================
// Update Card 2 – Total Amount Spent
// ======================================

function updateTotalAmountSpentCard(amount) {
    const el = document.getElementById("total-amount-spent-value");
    if (el) {
        el.textContent = `₹${Number(amount || 0).toLocaleString()}`;
    }
}

// ======================================
// Update Card 3 – This Month's Expenses
// ======================================

function updateThisMonthExpensesCard(amount) {
    const el = document.getElementById("this-month-expenses-value");
    if (el) {
        el.textContent = `₹${Number(amount || 0).toLocaleString()}`;
    }
}

// ======================================
// Update Card 4 – Categories Used
// ======================================

function updateCategoriesUsedCard(count) {
    const el = document.getElementById("categories-used-value");
    if (el) {
        el.textContent = Number(count || 0).toLocaleString();
    }
}

// ======================================
// Top Categories
// ======================================

function loadTopCategories(topCategories) {
    const container = document.getElementById("top-categories-list");
    if (!container) return;

    const categories = Array.isArray(topCategories) ? topCategories : [];

    if (categories.length === 0) {
        container.innerHTML = `<div class="category-item"><span>No category data.</span></div>`;
        return;
    }

    const items = categories.map(cat => {
        const icon = cat.category_icon || "📦";
        const name = cat.category_name ?? "Unknown";
        const amount = cat.total_amount ?? 0;
        return `
            <div class="category-item">
                <span>${escapeHtml(icon)} ${escapeHtml(name)}</span>
                <strong>₹${Number(amount).toLocaleString()}</strong>
            </div>
        `;
    });

    container.innerHTML = items.join("");
}

// ======================================
// Recent Transactions
// ======================================

function loadRecentTransactions(recentExpenses) {
    const tableBody = document.querySelector(".transactions tbody");
    if (!tableBody) return;

    const rows = Array.isArray(recentExpenses) ? recentExpenses : [];

    if (rows.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center;">
                    No recent expenses.
                </td>
            </tr>
        `;
        return;
    }

    const html = rows.map(expense => {
        const title = expense.title ?? "";
        const icon = expense.category_icon || "📦";
        const name = expense.category_name ?? "Unknown";
        const date = expense.expense_date ?? "";
        const amount = expense.amount ?? 0;
        return `
            <tr>
                <td>${escapeHtml(title)}</td>
                <td>${escapeHtml(icon)} ${escapeHtml(name)}</td>
                <td>${escapeHtml(date)}</td>
                <td>₹${Number(amount).toLocaleString()}</td>
                <td><span class="completed">Completed</span></td>
            </tr>
        `;
    });

    tableBody.innerHTML = html.join("");
}

