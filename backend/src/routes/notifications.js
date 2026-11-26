import { pool } from '../db.js';

// Notifications for the logged-in user: everything sent to "all users" plus their own group's.
const VISIBLE = `(n.target_group IS NULL OR n.target_group = (SELECT group_name FROM users WHERE id = $1))`;

export default async function notificationRoutes(app) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/notifications -> my notifications (newest first) with a read flag
  app.get('/', async (request) => {
    const { rows } = await pool.query(
      `SELECT n.id, n.title, n.message, n.target_group, n.created_at,
              (r.user_id IS NOT NULL) AS read
       FROM notifications n
       LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = $1
       WHERE ${VISIBLE}
       ORDER BY n.created_at DESC LIMIT 50`,
      [request.user.id]
    );
    return rows;
  });

  // PATCH /api/notifications/:id/read
  app.patch('/:id/read', {
    schema: { params: { type: 'object', properties: { id: { type: 'integer' } } } }
  }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT n.id FROM notifications n WHERE n.id = $2 AND ${VISIBLE}`,
      [request.user.id, request.params.id]
    );
    if (!rows[0]) return reply.code(404).send({ message: 'Notification not found.' });
    await pool.query(
      'INSERT INTO notification_reads (notification_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [request.params.id, request.user.id]
    );
    return { id: request.params.id, read: true };
  });

  // POST /api/notifications/read-all
  app.post('/read-all', async (request) => {
    const { rowCount } = await pool.query(
      `INSERT INTO notification_reads (notification_id, user_id)
       SELECT n.id, $1 FROM notifications n WHERE ${VISIBLE}
       ON CONFLICT DO NOTHING`,
      [request.user.id]
    );
    return { marked: rowCount };
  });
}
