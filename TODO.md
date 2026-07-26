# Expense Tracker Bug Fix - Implementation Steps

## ✅ Step 1: Modify `backend/routes/expenses.py`
- [x] Added `_extract_data()` helper that reads from BOTH `request.form` (FormData) and `request.get_json()` (JSON)
- [x] Modified `add_expense()` to use `_extract_data()` instead of `request.form.to_dict()`
- [x] Modified `edit_expense()` to use `_extract_data()` instead of `request.form.to_dict()`
- [x] Preserved FormData support for file uploads via `_handle_receipt_upload()`
- [x] All existing business logic intact

## ✅ Step 2: Modify `frontend/js/expense.js`
- [x] Read the selected payment method from the form using `form.querySelectorAll("select")[1]`
- [x] When no file is attached, send JSON with `Content-Type: application/json` via `getAuthHeaders("application/json")`
- [x] When a file is attached, send FormData (browser auto-sets Content-Type)
- [x] Authorization Bearer token is sent correctly in both cases

## ✅ Step 3: Verify compatibility
- [x] No syntax errors in modified files
- [x] Frontend and backend remain compatible
