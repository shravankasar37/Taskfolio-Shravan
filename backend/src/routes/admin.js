import { pool } from '../db.js';

export default async function adminRoutes(app) {
  app.addHook('onRequest', app.authenticate);  // must be logged in
  app.addHook('onRequest', app.requireAdmin);  // and must be an admin

  // GET /api/admin/users -> all users (never send password_hash)
  app.get('/users', async () => {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY id'
    );
    return rows;
  });

  // GET /api/admin/tasks -> every task from every user
  app.get('/tasks', async () => {
    const { rows } = await pool.query(
      `SELECT id, user_id, title, description, status, priority, due_date, completed_at, created_at, updated_at
       FROM tasks ORDER BY created_at DESC`
    );
    return rows;
  });

  // GET /api/admin/stats -> task statistics (overall + per user)
  app.get('/stats', async () => {
    const totals = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
       FROM tasks`
    );
    const perUser = await pool.query('SELECT * FROM user_task_stats ORDER BY user_id');
    return { ...totals.rows[0], users: perUser.rows };
  });

  // PATCH /api/admin/users/:id { name } or { is_active }
  app.patch('/users/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'integer' } } },
      body: {
        type: 'object',
        minProperties: 1,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          is_active: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { name, is_active } = request.body;
    if (is_active === false && request.params.id === request.user.id) {
      return reply.code(400).send({ message: "You can't deactivate your own account." });
    }
    if (name !== undefined && !name.trim()) return reply.code(400).send({ message: 'Name is required.' });
    const { rows } = await pool.query(
      `UPDATE users SET name = COALESCE($2, name), is_active = COALESCE($3, is_active)
       WHERE id = $1 RETURNING id, name, email, role, is_active, created_at`,
      [request.params.id, name?.trim() ?? null, is_active ?? null]
    );
    if (!rows[0]) return reply.code(404).send({ message: 'User not found.' });
    return rows[0];
  });
}
