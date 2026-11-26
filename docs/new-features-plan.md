# New Features Plan – Taskfolio (GRP 10)

Owner: Shravan Sunil Kasar (Group Leader) · Created: 26-Nov-2026
Applies to: **every member's own fork** (Task 3 is individual – each intern builds these in their own copy).

These are the changes Vyas sir asked for in the group meeting, which must be finished **before** the AI integration
(see `docs/ai-integration-plan.md`).

> ⚠️ **Confirm with Vyas sir:** the meeting notes were not written down. Features 2 and 3 below use the most likely
> meaning. If sir meant something different, update this file before building.

---

## 0. Where the app is today

| Area | Status |
|---|---|
| Register, login, logout, User/Admin roles | ✅ Done |
| User: add / edit / delete / complete / reopen tasks, filters, search, sort, due-date labels | ✅ Done |
| Admin: all users, all tasks, statistics, rename, activate / deactivate | ✅ Done |
| Live deployment (Render + Neon) | ✅ Done |
| **Dark mode** | ❌ To build |
| **Group-wise notifications** | ❌ To build |
| **User and Admin login updates** | ❌ To build |

---

## 1. Dark mode

**What:** a Light / Dark switch for both User and Admin.

| Part | Change |
|---|---|
| Frontend | Toggle button (🌙 / ☀️) in the top bar and on the sign-in page. Colours move into CSS variables on `:root`; a `[data-theme="dark"]` block overrides them. |
| Saving the choice | Store `light` / `dark` in `localStorage`. First visit follows the system setting (`prefers-color-scheme`). |
| Backend / DB | No change. |

**Done when:** every screen (sign-in, register, user dashboard, admin dashboard, forms, badges, buttons) is readable in both modes,
and the choice is remembered after refresh.

---

## 2. Group-wise notifications

**Assumed meaning (confirm):** the admin sends a notification to **all users** or to **one group** (e.g. GRP 10),
and users see it in a 🔔 bell with an unread count. Users also get automatic task alerts.

| Part | Change |
|---|---|
| Database | `users.group_name VARCHAR(50)` (e.g. `GRP 10`), chosen at registration. New table `notifications (id, title, message, target_group NULL = everyone, created_by, created_at)` and `notification_reads (notification_id, user_id, read_at)`. |
| Backend | `POST /api/admin/notifications` (admin sends to all or one group) · `GET /api/notifications` (my notifications + unread flag) · `PATCH /api/notifications/:id/read` · `GET /api/admin/groups` (list of groups). |
| Frontend – Admin | "Send notification" form: title, message, target (All users / a group). List of sent notifications. Filter users by group. |
| Frontend – User | 🔔 bell with unread count; panel listing notifications; click to mark as read. |
| Automatic task alerts | In the same panel, grouped by type: **Overdue**, **Due today**, **Due tomorrow** (calculated from the user's own tasks – no DB change). |

**Done when:** admin sends to "GRP 10" → only GRP 10 users see it; sending to "All users" → everyone sees it;
unread count drops after reading; users see their overdue / due-today tasks grouped.

---

## 3. User and Admin login updates

**Assumed meaning (confirm):** separate sign-in for User and Admin, plus a profile page.

| Part | Change |
|---|---|
| Sign-in page | Two tabs: **User login** and **Admin login**. Admin tab signs in with `POST /api/auth/login` + `{ "as": "admin" }`; the backend rejects non-admins with "This account is not an admin". A user account on the Admin tab (or an admin on the User tab) gets a clear message. |
| Registration | Only creates **user** accounts (admins are never self-registered). Adds the **group** field (needed for notifications). |
| Profile (both roles) | "My profile" page: change display name and **change password** (current password required). `PATCH /api/auth/me`, `PATCH /api/auth/password`. |
| After login | User → "My tasks"; Admin → "Admin dashboard" with a different header colour / "ADMIN" badge so it's obvious which mode you are in. |

**Done when:** admin can only sign in via Admin login; user only via User login; both can change name and password;
wrong role shows a clear error.

---

## 4. Bug fixes and polish (do alongside)

- Run all 39 test cases in `docs/test-cases.md` again after these changes; log anything failing in `docs/bug-report.md`.
- Change the default admin password on the live site (it was shared in the group chat).
- Render free plan sleeps: first load takes ~30 s – mention it in the README.

---

## 5. Order of work (per member, in your own fork)

1. Fork / copy the repo → set up locally (`database/README.md`, `backend/README.md`).
2. Dark mode (smallest, frontend only).
3. Login updates (needed before notifications because of the group field).
4. Group-wise notifications.
5. Retest → deploy your own copy → then start the AI feature (`docs/ai-integration-plan.md`).
