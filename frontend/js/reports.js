// ======================================
// Expense Tracker
// Reports Script
// ======================================

let monthlyChartInstance = null;
let categoryChartInstance = null;
let reportData = null;

document.addEventListener("DOMContentLoaded", () => {

    if (!authGuard()) return;

    loadReports();

    // Download Report button
    const downloadBtn = document.querySelector(".download-btn");
    if (downloadBtn) {
        downloadBtn.addEventListener("click", downloadPDFReport);
    }

});

// ======================================
// Load Reports
// ======================================

async function loadReports() {

    try {

        const response = await fetchWithAuth(`${API_BASE_URL}/api/reports/`);

        if (!response.ok) {
            const msg = await extractErrorMessage(new Error("Failed to load reports"), response);
            if (typeof showToast === "function") {
                showToast(msg, "error");
            }
            return;
        }

        const data = await response.json();

        reportData = data;

        updateSummaryCards(data);
        populateMonthlyExpenses(data.monthly_expenses);
        populateCategorySummary(data.category_expenses);
        populateBudgetSummary(data.budget_summary);
        renderMonthlyChart(data.monthly_expenses);
        renderCategoryChart(data.category_expenses);

    } catch (error) {

        console.error(error);
        const msg = await extractErrorMessage(error, null);
        if (typeof showToast === "function") {
            showToast(msg, "error");
        }

    }

}

// ======================================
// Summary Cards
// ======================================

function updateSummaryCards(data) {

    const totalExpensesEl = document.getElementById("total-expenses-value");

    if (totalExpensesEl) {
        totalExpensesEl.textContent = Number(data.total_expenses).toLocaleString();
    }

    const totalAmountEl = document.getElementById("total-amount-value");

    if (totalAmountEl) {
        totalAmountEl.textContent = `₹${Number(data.total_amount_spent).toLocaleString()}`;
    }

}

// ======================================
// Monthly Expenses Table
// ======================================

function populateMonthlyExpenses(monthlyExpenses) {

    const tbody = document.getElementById("monthly-expenses-body");

    if (!tbody) return;

    tbody.innerHTML = "";

    const rows = Array.isArray(monthlyExpenses) ? monthlyExpenses : [];

    if (rows.length === 0) {

        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;padding:30px;color:#6B7280;">No monthly expense data.</td></tr>`;
        return;

    }

    // Build all rows first and write them in a single DOM update
    tbody.innerHTML = rows.map(item => {

        const month = item.month ?? "Unknown";
        const amount = item.amount ?? 0;

        return `
            <tr>
                <td>${escapeHtml(month)}</td>
                <td>₹${Number(amount).toLocaleString()}</td>
            </tr>
        `;

    }).join("");

}

// ======================================
// Download PDF Report
// ======================================

function downloadPDFReport() {

    if (!reportData) {
        if (typeof showToast === "function") {
            showToast("Report data is not loaded yet. Please wait and try again.", "warning");
        } else {
            alert("Report data is not loaded yet. Please wait and try again.");
        }
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();

    // Today's date for filename and report
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
    const formattedDate = today.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    // ==============================
    // Title
    // ==============================
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Expense Tracker Report", pageWidth / 2, 22, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Generated: " + formattedDate, pageWidth / 2, 30, { align: "center" });

    // ==============================
    // Summary Section
    // ==============================
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, 42);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const totalExpenses = Number(reportData.total_expenses).toLocaleString();
    const totalAmount = "Rs. " + Number(reportData.total_amount_spent).toLocaleString();
    doc.text("Total Expenses: " + totalExpenses, 14, 51);
    doc.text("Total Amount Spent: " + totalAmount, 14, 59);

    // ==============================
    // Monthly Expenses Table
    // ==============================
    let startY = 70;

    if (Array.isArray(reportData.monthly_expenses) && reportData.monthly_expenses.length > 0) {
        const monthlyRows = reportData.monthly_expenses.map(item => [
            item.month ?? "Unknown",
            "Rs. " + Number(item.amount ?? 0).toLocaleString(),
        ]);

        doc.autoTable({
            startY: startY,
            head: [["Month", "Amount"]],
            body: monthlyRows,
            theme: "grid",
            headStyles: {
                fillColor: [99, 102, 241],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 11,
            },
            bodyStyles: {
                fontSize: 10,
            },
            margin: { top: 10 },
        });

        startY = doc.lastAutoTable.finalY + 12;
    } else {
        doc.setFontSize(11);
        doc.setFont("helvetica", "italic");
        doc.text("Monthly Expenses: No data available.", 14, startY + 5);
        startY += 15;
    }

    // ==============================
    // Category Summary Table
    // ==============================
    if (Array.isArray(reportData.category_expenses) && reportData.category_expenses.length > 0) {
        const catRows = reportData.category_expenses.map(item => [
            item.category_name ?? "Unknown",
            "Rs. " + Number(item.amount ?? 0).toLocaleString(),
        ]);

        doc.autoTable({
            startY: startY,
            head: [["Category", "Amount"]],
            body: catRows,
            theme: "grid",
            headStyles: {
                fillColor: [99, 102, 241],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 11,
            },
            bodyStyles: {
                fontSize: 10,
            },
            margin: { top: 10 },
        });

        startY = doc.lastAutoTable.finalY + 12;
    } else {
        doc.setFontSize(11);
        doc.setFont("helvetica", "italic");
        doc.text("Category Summary: No data available.", 14, startY + 5);
        startY += 15;
    }

    // ==============================
    // Budget Summary Table
    // ==============================
    if (Array.isArray(reportData.budget_summary) && reportData.budget_summary.length > 0) {
        const budgetRows = reportData.budget_summary.map(item => [
            item.category_name ?? "Unknown",
            "Rs. " + Number(item.budget ?? 0).toLocaleString(),
            "Rs. " + Number(item.spent ?? 0).toLocaleString(),
            "Rs. " + Number(item.remaining ?? 0).toLocaleString(),
        ]);

        doc.autoTable({
            startY: startY,
            head: [["Category", "Budget", "Spent", "Remaining"]],
            body: budgetRows,
            theme: "grid",
            headStyles: {
                fillColor: [99, 102, 241],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 11,
            },
            bodyStyles: {
                fontSize: 10,
            },
            margin: { top: 10 },
        });
    } else {
        doc.setFontSize(11);
        doc.setFont("helvetica", "italic");
        doc.text("Budget Summary: No data available.", 14, startY + 5);
    }

    // ==============================
    // Save PDF
    // ==============================
    const filename = "Expense_Report_" + dateStr + ".pdf";
    doc.save(filename);

}

// ======================================
// Category Summary Table
// ======================================

function populateCategorySummary(categoryExpenses) {

    const tbody = document.getElementById("category-summary-body");

    if (!tbody) return;

    tbody.innerHTML = "";

    const rows = Array.isArray(categoryExpenses) ? categoryExpenses : [];

    if (rows.length === 0) {

        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;padding:30px;color:#6B7280;">No category data.</td></tr>`;
        return;

    }

    // Build all rows first and write them in a single DOM update
    tbody.innerHTML = rows.map(item => {

        const name = item.category_name ?? "Unknown";
        const amount = item.amount ?? 0;

        // Try to show category icon if available (API may or may not include it)
        const icon = item.category_icon ? item.category_icon + " " : "";

        return `
            <tr>
                <td>${icon}${escapeHtml(name)}</td>
                <td>₹${Number(amount).toLocaleString()}</td>
            </tr>
        `;

    }).join("");

}

// ======================================
// Budget Summary Table
// ======================================

function populateBudgetSummary(budgetSummary) {

    const tbody = document.getElementById("budget-summary-body");

    if (!tbody) return;

    tbody.innerHTML = "";

    const rows = Array.isArray(budgetSummary) ? budgetSummary : [];

    if (rows.length === 0) {

        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:#6B7280;">No budget data.</td></tr>`;
        return;

    }

    // Build all rows first and write them in a single DOM update
    tbody.innerHTML = rows.map(item => {

        const name = item.category_name ?? "Unknown";
        const budget = item.budget ?? 0;
        const spent = item.spent ?? 0;
        const remaining = item.remaining ?? 0;

        // Determine remaining color class
        let remainingClass = "remaining-zero";
        if (remaining > 0) {
            remainingClass = "remaining-positive";
        } else if (remaining < 0) {
            remainingClass = "remaining-negative";
        }

        return `
            <tr>
                <td>${escapeHtml(name)}</td>
                <td>₹${Number(budget).toLocaleString()}</td>
                <td>₹${Number(spent).toLocaleString()}</td>
                <td class="${remainingClass}">₹${Number(remaining).toLocaleString()}</td>
            </tr>
        `;

    }).join("");

}

// ======================================
// Monthly Bar Chart (Chart.js)
// ======================================

function renderMonthlyChart(monthlyExpenses) {

    const canvas = document.getElementById("monthlyChart");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Destroy previous chart instance if it exists
    if (monthlyChartInstance) {
        monthlyChartInstance.destroy();
    }

    const rows = Array.isArray(monthlyExpenses) ? monthlyExpenses : [];

    const labels = rows.map(item => item.month ?? "Unknown");
    const data = rows.map(item => item.amount ?? 0);

    monthlyChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Amount (₹)",
                data: data,
                backgroundColor: "rgba(99, 102, 241, 0.75)",
                borderColor: "rgba(99, 102, 241, 1)",
                borderWidth: 2,
                borderRadius: 6,
                barPercentage: 0.65,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0
            },
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            return "₹" + Number(context.raw).toLocaleString();
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return "₹" + Number(value).toLocaleString();
                        }
                    },
                    grid: {
                        color: "rgba(0,0,0,0.06)",
                    }
                },
                x: {
                    grid: {
                        display: false,
                    }
                }
            },
            hover: {
                animationDuration: 0
            },
            resize: {
                delay: 0
            }
        }
    });

}

// ======================================
// Category Pie Chart (Chart.js)
// ======================================

function renderCategoryChart(categoryExpenses) {

    const canvas = document.getElementById("categoryChart");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Destroy previous chart instance if it exists
    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    const rows = Array.isArray(categoryExpenses) ? categoryExpenses : [];

    const labels = rows.map(item => item.category_name ?? "Unknown");
    const data = rows.map(item => item.amount ?? 0);

    // Distinct colors for each category slice
    const colorPalette = [
        "#6366F1", "#22C55E", "#F59E0B", "#EF4444",
        "#3B82F6", "#EC4899", "#14B8A6", "#F97316",
        "#8B5CF6", "#06B6D4", "#84CC16", "#D946EF"
    ];

    const backgroundColors = rows.map((_, index) => colorPalette[index % colorPalette.length]);

    categoryChartInstance = new Chart(ctx, {
        type: "pie",
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderColor: "#FFFFFF",
                borderWidth: 3,
                hoverOffset: 12,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0
            },
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        padding: 16,
                        usePointStyle: true,
                        font: {
                            size: 13,
                            family: "'Poppins', sans-serif",
                        }
                    }
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const value = context.raw;
                            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return "₹" + Number(value).toLocaleString() + " (" + pct + "%)";
                        }
                    }
                }
            },
            hover: {
                animationDuration: 0
            },
            resize: {
                delay: 0
            }
        }
    });

}
