# Backend - Node.js + Fastify

## Run locally
1. Set up the database first (see `database/README.md`).
2. Copy `.env.example` to `.env` and fill in your own values (database password, JWT secret, Gemini + Groq keys).
3. `npm install`
4. `npm run dev` -> http://localhost:5000/api/health

No AI keys yet? Set `AI_MOCK=true` in `.env` to test the screens with fake replies (local only, never counted in the comparison).

## API
### Auth & profile
POST   /api/auth/register      { name, email, password, group_name? }
POST   /api/auth/login         { email, password, as?: "user" | "admin" } -> { token, user }
GET    /api/auth/me            my profile
PATCH  /api/auth/me            { name?, group_name? }
PATCH  /api/auth/password      { current_password, new_password }

### Tasks
GET    /api/tasks              my tasks
POST   /api/tasks              create task (title, description, priority, status, due_date, estimated_minutes)
PUT    /api/tasks/:id          edit task (all fields)
PATCH  /api/tasks/:id          edit only changed fields
DELETE /api/tasks/:id          delete task

### Notifications
GET    /api/notifications              my notifications (all users + my group)
PATCH  /api/notifications/:id/read     mark one as read
POST   /api/notifications/read-all     mark all as read
GET    /api/admin/groups               groups with member counts (admin)
POST   /api/admin/notifications        { title, message, target_group? } – null = all users (admin)
GET    /api/admin/notifications        sent notifications with read counts (admin)
DELETE /api/admin/notifications/:id    (admin)

### Admin
GET    /api/admin/users        all users (admin)
GET    /api/admin/tasks        all tasks (admin)
GET    /api/admin/stats        task statistics (admin)
PATCH  /api/admin/users/:id    { name } or { is_active } (admin)

### AI – Gemini vs Groq
GET    /api/ai/features        features available to me + provider status
POST   /api/ai/:feature        { provider: "gemini" | "groq", ...input } -> { provider, model, elapsedMs, result }
GET    /api/ai/stats           average response time per feature and provider

Features: `daily-planner`, `overdue-rescue`, `time-estimate`, `weekly-report`, `due-date`, `description`, `ask` (users),
`notification-writer` (admin). The same prompt is sent to both providers; every real call is timed and logged in `ai_runs`.
