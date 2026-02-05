# Admin Account Overview — Discovery Output

## 1) File paths

### Account Overview page + related components
- **Page:** `frontend/src/pages/admin/AdminAccountDetailPage.tsx` (route: `/admin/accounts/:accountId`)
- **Layout:** `frontend/src/pages/admin/AdminLayout.tsx`
- **Styles:** `frontend/src/pages/admin/Admin.css`
- **API client:** `frontend/src/api/admin.ts` (`fetchAdminAccountById`, `fetchAdminAudits`, `postQuarantine`, `deleteQuarantine`, `postThrottle`, `deleteThrottle`, `postForceLogout`)

### Admin API routes used by that page
- **Single account:** `GET /api/admin/beta/accounts/:accountId` → `backend/src/routes/adminBeta.route.ts` (router.get("/accounts/:accountId", ...))
- **Audits:** `GET /api/admin/accounts/:accountId/audits` → `backend/src/routes/admin/security.route.ts`
- **Quarantine/Throttle/Force logout:** `POST/DELETE /api/admin/accounts/:accountId/security/*` → `backend/src/routes/admin/security.route.ts`

### Router mounting
- `backend/src/server.ts`: `app.use("/api/admin", requireAdminAuth, adminRouter)`
- `backend/src/routes/admin/index.ts`: `router.use("/beta", adminBetaRouter)` → so beta routes are at `/api/admin/beta/*`
- `backend/src/routes/admin/index.ts`: `router.use("/accounts", requireSuperAdmin, securityRouter)` → security at `/api/admin/accounts/:accountId/*`

## 2) Current response shape for account detail

**Endpoint:** `GET /api/admin/beta/accounts/:accountId`

**Sample JSON:**
```json
{
  "accountId": "...",
  "name": "Account name (Account.name)",
  "slug": "account-slug",
  "region": "Canada",
  "isActive": true,
  "createdAt": "2024-01-15T00:00:00.000Z",
  "lastActiveAt": "2025-02-01T12:00:00.000Z",
  "counts": {
    "workOrders": 10,
    "invoices": 5,
    "customers": 20,
    "users": 3
  }
}
```

**Note:** `name` is from `Account.name`. Shop display name is in `Settings.shopName` and is **not** currently returned by this endpoint.

## 3) Where Account.slug is defined and used

- **Defined:** `backend/src/models/account.model.ts` — `slug?: string` (unique, sparse). Used for tenant login scoping (shop code).
- **Used:** 
  - `adminBeta.route.ts`: list/detail return it; list search matches `Account.slug` and `Settings.shopName`.
  - `auth.routes.ts`: login uses `shopCode` to resolve account by `Account.slug`.
  - `settings.route.ts`: owners see/regenerate slug as “Shop Code”.

## 4) User model — lastLoginAt

- **User model** (`backend/src/models/user.model.ts`): **No `lastLoginAt` field.** Fields include: accountId, email, firstName, lastName, phone, name, role, passwordHash, isActive, tokenInvalidBefore, mustChangePassword, tempPasswordExpiresAt, createdAt, updatedAt.
- **Account model** has `lastActiveAt` (updated by requireAuth throttle); that is the “last activity” for the account, not per-user login time.

## 5) Owner resolution / usage

- **Primary owner:** Not currently resolved in the account detail endpoint. Would be: `User.findOne({ accountId, role: "owner", isActive: true })` (or first owner if multiple).
- **User counts:** Already returned as `counts.users` from `User.countDocuments({ accountId, role: { $in: TENANT_ROLES } })` in `adminBeta.route.ts` (TENANT_ROLES = owner, manager, technician).

## 6) mustChangePassword

- **Model:** `backend/src/models/user.model.ts` — `mustChangePassword?: boolean` (default false).
- **Usage:** Set true in reset-password flow; cleared on change-password; login response includes `mustChangePassword` for frontend redirect.
