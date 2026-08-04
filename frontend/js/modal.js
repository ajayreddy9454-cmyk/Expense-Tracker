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
 * @param {Function} [options.onConfirm] - Callback when confirmed (may return a Promise)
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

        let settled = false;

        // ESC handler — always removed when modal closes so repeated
        // open/close cycles never leak listeners.
        function escHandler(e) {
            if (e.key === 'Escape') {
                closeModal(false);
            }
        }

        // Cleanup function
        function closeModal(result) {
            if (settled) return;
            settled = true;

            document.removeEventListener('keydown', escHandler);

            overlay.classList.remove('active');
            setTimeout(() => {
                if (overlay.parentElement) {
                    overlay.parentElement.removeChild(overlay);
                }
                if (result && onConfirm) {
                    // Support async onConfirm: await it (best effort), but do
                    // not block the promise resolution indefinitely.
                    try {
                        const maybePromise = onConfirm();
                        if (maybePromise && typeof maybePromise.then === 'function') {
                            maybePromise.catch(err => console.error('onConfirm error:', err));
                        }
                    } catch (err) {
                        console.error('onConfirm error:', err);
                    }
                }
                if (!result && onCancel) onCancel();
                resolve(result);
            }, 250);
        }

        // Event listeners
        cancelBtn.addEventListener('click', () => closeModal(false));

        confirmBtn.addEventListener('click', async () => {
            // Prevent double-submission: disable the confirm button and show a
            // spinner while the operation runs (if any).
            confirmBtn.disabled = true;
            cancelBtn.disabled = true;

            // Add a spinner to the confirm button
            const originalHtml = confirmBtn.innerHTML;
            if (typeof setButtonLoading === 'function' && confirmText !== '') {
                setButtonLoading(confirmBtn, true, 'Working...');
            } else {
                confirmBtn.innerHTML = '<span class="button-spinner"></span>';
            }

            try {
                const result = onConfirm ? await onConfirm() : true;
                closeModal(result !== false ? true : false);
            } catch (err) {
                console.error('onConfirm error:', err);
                // Restore button and keep modal open so the user can retry/cancel
                confirmBtn.disabled = false;
                cancelBtn.disabled = false;
                confirmBtn.innerHTML = originalHtml;
                if (typeof showToast === 'function') {
                    showToast('An unexpected error occurred. Please try again.', 'error');
                }
            }
        });

        // Click outside to close (but not if the confirm operation is in-flight)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && !confirmBtn.disabled) {
                closeModal(false);
            }
        });

        // ESC key to close
        document.addEventListener('keydown', escHandler);

        // Trigger enter
        requestAnimationFrame(() => {
            overlay.classList.add('active');
            confirmBtn.focus();
        });
    });
}

// NOTE: escapeHtml() is defined in js/toast.js (loaded on every page before modal.js)

