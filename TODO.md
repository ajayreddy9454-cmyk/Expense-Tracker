# Expense Tracker — Final Project Polish

## Approved Scope
1. Replace every authenticated `fetchWithTimeout()` call with `fetchWithAuth()` so the global 401 handler is actually used everywhere.
2. Remove the duplicate profile API request on profile.html.
3. Fix the stale avatar cache key issue.
4. Consolidate backend summary queries where possible.
5. Cache the authenticated user in Flask's `g` object per request.
6. Use `Promise.all()` for independent requests.
7. Add lightweight loading states to Dashboard and Reports.
8. Keep all existing functionality unchanged.

## Explicitly Out of Scope
- No UI design changes
- No API endpoint changes
- No database schema changes
- No authentication flow changes
- No deployment configuration changes

---

## Status: Complete

### Phase 1 — Backend
- [x] Cache current user in `g` object per request (utils/helpers.py)
- [x] Consolidate dashboard summary queries (routes/dashboard.py)
- [x] Consolidate reports summary queries (routes/reports.py)
- [x] Consolidate profile count queries (routes/profile.py)

### Phase 2 — Frontend Auth Helper
- [x] Replace all authenticated `fetchWithTimeout` calls with `fetchWithAuth` (utils.js + all page scripts)
- [x] Remove duplicate auth logic

### Phase 3 — Profile & Avatar
- [x] Remove duplicate profile API fetch on profile.html (app.js)
- [x] Fix stale avatar cache key (profile.js)
- [x] Use shared avatar helper consistently

### Phase 4 — Performance
- [x] Use Promise.all for independent expense page requests (expense.js)
- [x] Add loading states to Dashboard (dashboard.js)
- [x] Add loading states to Reports (reports.js)

### Phase 5 — Verification
- [x] Syntax verification (py_compile + JS review)
- [x] Verify Login, Register, Logout
- [x] Verify Dashboard, Expenses, Categories, Budget, Reports, Profile, Settings
- [x] Verify expired token auto-redirects to Login
- [x] Final report

---

## Phase 6 — Final Report
Delivered in the completion message (files modified, bugs fixed, performance improvements, security improvements, dead code removed, estimated performance gain).
