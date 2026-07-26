// ======================================
// Expense Tracker
// Toast Notification System
// ======================================

// Toast icon map
const TOAST_ICONS = {
    success: '<i class="fa-solid fa-check"></i>',
    error: '<i class="fa-solid fa-xmark"></i>',
    warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
    info: '<i class="fa-solid fa-circle-info"></i>'
};

// Toast duration in ms
const TOAST_DURATION = 3000;

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - One of: 'success', 'error', 'warning', 'info'
 */
function showToast(message, type) {
    // Default to 'info' if type is invalid
    if (!TOAST_ICONS[type]) type = 'info';

    // Get or create container
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${TOAST_ICONS[type]}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
        <button class="toast-close" onclick="dismissToast(this.parentElement)">
            <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="toast-progress"></div>
    `;

    // Append to container
    container.appendChild(toast);

    // Auto-dismiss after duration
    const timeoutId = setTimeout(() => {
        dismissToast(toast);
    }, TOAST_DURATION);

    // Store timeout ID on element for cleanup
    toast._timeoutId = timeoutId;
}

/**
 * Dismiss a toast with animation
 * @param {HTMLElement} toast
 */
function dismissToast(toast) {
    if (!toast || toast.classList.contains('toast-leaving')) return;

    // Clear auto-dismiss timeout
    if (toast._timeoutId) {
        clearTimeout(toast._timeoutId);
    }

    // Start leave animation
    toast.classList.add('toast-leaving');

    // Remove after animation completes
    setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }

        // Remove container if empty
        const container = document.querySelector('.toast-container');
        if (container && container.children.length === 0) {
            container.parentElement.removeChild(container);
        }
    }, 300);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


