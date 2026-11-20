import { pool } from '../db.js';

const COLUMNS = 'id, user_id, title, description, status, priority, due_date, completed_at, created_at, updated_at';

const taskFields = {
  title: { type: 'string', minLength: 1, maxLength: 200 },
  description: { type: ['string', 'null'] },
  status: { type: 'string', enum: ['pending', 'completed'] },
  priority: { type: 'string', enum: ['low', 'medium', 'high'] },
  due_date: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] }
};

const idParam = { type: 'object', properties: { id: { type: 'integer' } } };

// Finds a task the logged-in user is allowed to change (their own, or any task for an admin).
async function findAllowedTask(request) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM tasks WHERE id = $1`, [request.params.id]);
  const task = rows[0];
  if (!task) return null;
  if (task.user_id !== request.user.id && request.user.role !== 'admin') return null;
  return task;
}

export default async function taskRoutes(app) {
  app.addHook('onRequest', app.authenticate); // every task route needs a valid token

  // GET /api/tasks -> the logged-in user's tasks
  app.get('/', async (request) => {
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM tasks WHERE user_id = $1 ORDER BY created_at DESC`,
      [request.user.id]
    );
    return rows;
  });

  // POST /api/tasks { title, description, priority, status, due_date }
  app.post('/', {
    schema: { body: { type: 'object', required: ['title'], properties: taskFields } }
  }, async (request, reply) => {
    const { title, description = null, status = 'pending', priority = 'medium', due_date = null } = request.body;
    if (!title.trim()) return reply.code(400).send({ message: 'Title is required.' });
    const { rows } = await pool.query(
      `INSERT INTO tasks (user_id, title, description, status, priority, due_date, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
      [request.user.id, title.trim(), description, status, priority, due_date,
        status === 'completed' ? new Date() : null]
    );
    return reply.code(201).send(rows[0]);
  });

  // PUT (all fields) and PATCH (only changed fields, e.g. { "status": "completed" })
  const update = async (request, reply) => {
    const task = await findAllowedTask(request);
    if (!task) return reply.code(404).send({ message: 'Task not found.' });
    const next = { ...task, ...request.body };
    if (!next.title || !next.title.trim()) return reply.code(400).send({ message: 'Title is required.' });
    const completedAt = next.status === 'completed' ? (task.completed_at || new Date()) : null;
    const { rows } = await pool.query(
      `UPDATE tasks SET title = $1, description = $2, status = $3, priority = $4, due_date = $5, completed_at = $6
       WHERE id = $7 RETURNING ${COLUMNS}`,
      [next.title.trim(), next.description, next.status, next.priority, next.due_date, completedAt, task.id]
    );
    return rows[0];
  };

  app.put('/:id', { schema: { params: idParam, body: { type: 'object', required: ['title'], properties: taskFields } } }, update);
  app.patch('/:id', { schema: { params: idParam, body: { type: 'object', minProperties: 1, properties: taskFields } } }, update);

  // DELETE /api/tasks/:id
  app.delete('/:id', { schema: { params: idParam } }, async (request, reply) => {
    const task = await findAllowedTask(request);
    if (!task) return reply.code(404).send({ message: 'Task not found.' });
    await pool.query('DELETE FROM tasks WHERE id = $1', [task.id]);
    return reply.code(204).send();
  });
}
