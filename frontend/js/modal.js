// ======================================
// Expense Tracker
// Confirmation Modal System
// ======================================

/**
 * Show a confirmation modal
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {string} options.message - Modal message/body text
 * @param {string} [options.confirmText='Delete'] - Confirm button text
 * @param {string} [options.cancelText='Cancel'] - Cancel button text
 * @param {string} [options.icon='danger'] - Icon type: 'danger', 'warning', 'info'
 * @param {string} [options.confirmClass='modal-confirm-btn-confirm'] - Button class for confirm
 * @param {Function} [options.onConfirm] - Callback when confirmed
 * @param {Function} [options.onCancel] - Callback when cancelled
 * @returns {Promise<boolean>} - Resolves true if confirmed, false if cancelled
 */
function showConfirmModal(options = {}) {
    return new Promise((resolve) => {
        const {
            title = 'Confirm',
            message = 'Are you sure?',
            confirmText = 'Delete',
            cancelText = 'Cancel',
            icon = 'danger',
            confirmClass = 'modal-confirm-btn-confirm',
            onConfirm = null,
            onCancel = null
        } = options;

        // Map icon types
        const iconMap = {
            danger: 'danger-icon',
            warning: 'warning-icon',
            info: 'info-icon'
        };
        const iconClass = iconMap[icon] || 'danger-icon';

        const iconHtml = icon === 'danger'
            ? '<i class="fa-solid fa-trash"></i>'
            : icon === 'warning'
                ? '<i class="fa-solid fa-triangle-exclamation"></i>'
                : '<i class="fa-solid fa-circle-info"></i>';

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-confirm-overlay';
        overlay.innerHTML = `
            <div class="modal-confirm">
                <div class="modal-confirm-header">
                    <div class="modal-confirm-icon ${iconClass}">${iconHtml}</div>
                    <h3 class="modal-confirm-title">${escapeHtml(title)}</h3>
                </div>
                <div class="modal-confirm-body">
                    <p class="modal-confirm-message">${escapeHtml(message)}</p>
                </div>
                <div class="modal-confirm-footer">
                    <button class="modal-confirm-btn modal-confirm-btn-cancel" id="modalConfirmCancel">${escapeHtml(cancelText)}</button>
                    <button class="modal-confirm-btn ${confirmClass}" id="modalConfirmConfirm">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Get elements
        const cancelBtn = overlay.querySelector('#modalConfirmCancel');
        const confirmBtn = overlay.querySelector('#modalConfirmConfirm');

        // Cleanup function
        function closeModal(result) {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (overlay.parentElement) {
                    overlay.parentElement.removeChild(overlay);
                }
                if (result && onConfirm) onConfirm();
                if (!result && onCancel) onCancel();
                resolve(result);
            }, 250);
        }

        // Event listeners
        cancelBtn.addEventListener('click', () => closeModal(false));
        confirmBtn.addEventListener('click', () => closeModal(true));

        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(false);
        });

        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escHandler);
                closeModal(false);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Trigger enter
        requestAnimationFrame(() => {
            overlay.classList.add('active');
            confirmBtn.focus();
        });
    });
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


