# Backend - Node.js + Fastify

## Run locally
1. Set up the database first (see database/README.md).
2. Copy .env.example to .env and fill in your own values.
3. npm install
4. npm run dev -> http://localhost:5000/api/health

## API
POST   /api/auth/register      { name, email, password }
POST   /api/auth/login         { email, password } -> { token, user }
GET    /api/tasks              my tasks
POST   /api/tasks              create task
PUT    /api/tasks/:id          edit task (all fields)
PATCH  /api/tasks/:id          edit only changed fields
DELETE /api/tasks/:id          delete task
GET    /api/admin/users        all users (admin)
GET    /api/admin/tasks        all tasks (admin)
GET    /api/admin/stats        task statistics (admin)
PATCH  /api/admin/users/:id    { name } or { is_active } (admin)
