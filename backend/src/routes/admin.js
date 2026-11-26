import { pool } from '../db.js';
import { COLUMNS } from './tasks.js';

export default async function adminRoutes(app) {
  app.addHook('onRequest', app.authenticate);  // must be logged in
  app.addHook('onRequest', app.requireAdmin);  // and must be an admin

  // GET /api/admin/users -> all users (never send password_hash)
  app.get('/users', async () => {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, is_active, group_name, created_at FROM users ORDER BY id'
    );
    return rows;
  });

  // GET /api/admin/tasks -> every task from every user
  app.get('/tasks', async () => {
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM tasks ORDER BY created_at DESC`);
    return rows;
  });

  // GET /api/admin/groups -> groups that have users, with member counts (for group-wise notifications)
  app.get('/groups', async () => {
    const { rows } = await pool.query(
      `SELECT group_name, COUNT(*)::int AS members FROM users
       WHERE group_name IS NOT NULL AND role = 'user' GROUP BY group_name ORDER BY group_name`
    );
    return rows;
  });

  // POST /api/admin/notifications { title, message, target_group? } – null/empty target = all users
  app.post('/notifications', {
    schema: {
      body: {
        type: 'object', required: ['title', 'message'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 120 },
          message: { type: 'string', minLength: 1, maxLength: 2000 },
          target_group: { type: ['string', 'null'], maxLength: 50 }
        }
      }
    }
  }, async (request, reply) => {
    const title = request.body.title.trim();
    const message = request.body.message.trim();
    if (!title || !message) return reply.code(400).send({ message: 'Title and message are required.' });
    const target = request.body.target_group?.trim() || null;
    if (target) {
      const { rows } = await pool.query('SELECT 1 FROM users WHERE group_name = $1 LIMIT 1', [target]);
      if (!rows[0]) return reply.code(400).send({ message: `No users are in group "${target}".` });
    }
    const { rows } = await pool.query(
      `INSERT INTO notifications (title, message, target_group, created_by) VALUES ($1, $2, $3, $4)
       RETURNING id, title, message, target_group, created_at`,
      [title, message, target, request.user.id]
    );
    return reply.code(201).send(rows[0]);
  });

  // GET /api/admin/notifications -> everything sent, with how many people have read it
  app.get('/notifications', async () => {
    const { rows } = await pool.query(
      `SELECT n.id, n.title, n.message, n.target_group, n.created_at,
              (SELECT COUNT(*)::int FROM notification_reads r WHERE r.notification_id = n.id) AS read_count,
              (SELECT COUNT(*)::int FROM users u WHERE u.role = 'user' AND u.is_active
                 AND (n.target_group IS NULL OR u.group_name = n.target_group)) AS audience
       FROM notifications n ORDER BY n.created_at DESC LIMIT 100`
    );
    return rows;
  });

  // DELETE /api/admin/notifications/:id
  app.delete('/notifications/:id', {
    schema: { params: { type: 'object', properties: { id: { type: 'integer' } } } }
  }, async (request, reply) => {
    const { rowCount } = await pool.query('DELETE FROM notifications WHERE id = $1', [request.params.id]);
    if (!rowCount) return reply.code(404).send({ message: 'Notification not found.' });
    return reply.code(204).send();
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
       WHERE id = $1 RETURNING id, name, email, role, is_active, group_name, created_at`,
      [request.params.id, name?.trim() ?? null, is_active ?? null]
    );
    if (!rows[0]) return reply.code(404).send({ message: 'User not found.' });
    return rows[0];
  });
}
