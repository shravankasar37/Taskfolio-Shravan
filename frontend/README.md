Angular frontend for the To-Do app

## Run locally
Use Node 22.12+ on the 22.x line or Node 24. In this folder run `npm install` and `npm start`.
Open http://localhost:4200. Run `npm run build` to compile for production.
The sign-in and registration forms render without a server. Dashboard data requires Fastify.
The dev proxy forwards /api to localhost:5000. Update proxy.json for the agreed port.

## Handoff to Adwaith
The following contract is provisional. Confirm paths and payloads before integration.
- POST /api/auth/register takes name, email, password and creates a regular user.
- POST /api/auth/login takes email, password and returns {token, user:{id,name,email,role}}.
- The client keeps the token in memory and sends it as a Bearer token. Refresh requires signing in again.
- GET /api/tasks returns the signed-in user's task array. POST /api/tasks and PUT /api/tasks/:id accept title, description, status, priority and due_date. DELETE /api/tasks/:id deletes one task.
- GET /api/admin/tasks and /api/admin/users return arrays. Admin statistics use the full unpaginated task array.
- PATCH /api/admin/users/:id accepts {name} or {is_active}. User records in the admin list include is_active. The admin dashboard supports renaming, activating and deactivating accounts. Fastify must enforce access changes and prevent self-deactivation.
- See services/api.ts for field types. Fastify must check identity, ownership and admin permissions on protected endpoints.
