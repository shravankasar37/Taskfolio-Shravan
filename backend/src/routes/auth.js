import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

const PROFILE = 'id, name, email, role, group_name';
const groupField = { type: ['string', 'null'], maxLength: 50 };

function cleanGroup(value) {
  const group = typeof value === 'string' ? value.trim() : '';
  return group ? group.toUpperCase().replace(/\s+/g, ' ') : null; // "grp 10" -> "GRP 10"
}

export default async function authRoutes(app) {
  // POST /api/auth/register { name, email, password, group_name? } – always creates a normal user
  app.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          email: { type: 'string', format: 'email', maxLength: 255 },
          password: { type: 'string', minLength: 6, maxLength: 72 },
          group_name: groupField
        }
      }
    }
  }, async (request, reply) => {
    const name = request.body.name.trim();
    const email = request.body.email.trim().toLowerCase();
    if (!name) return reply.code(400).send({ message: 'Name is required.' });
    const passwordHash = await bcrypt.hash(request.body.password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, group_name) VALUES ($1, $2, $3, $4)
       RETURNING ${PROFILE}`,
      [name, email, passwordHash, cleanGroup(request.body.group_name)]
    );
    return reply.code(201).send(rows[0]);
  });

  // POST /api/auth/login { email, password, as?: 'user' | 'admin' }
  // "as" comes from the User login / Admin login tab and must match the account's role.
  app.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          as: { type: 'string', enum: ['user', 'admin'] }
        }
      }
    }
  }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT ${PROFILE}, is_active, password_hash FROM users WHERE LOWER(email) = LOWER($1)`,
      [request.body.email.trim()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(request.body.password, user.password_hash))) {
      return reply.code(401).send({ message: 'Invalid email or password.' });
    }
    if (!user.is_active) {
      return reply.code(403).send({ message: 'Your account is inactive. Contact the admin.' });
    }
    if (request.body.as && request.body.as !== user.role) {
      return reply.code(403).send({
        message: user.role === 'admin'
          ? 'This is an admin account. Please use the Admin login tab.'
          : 'This account is not an admin. Please use the User login tab.'
      });
    }
    const token = app.jwt.sign({ id: user.id, role: user.role });
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, group_name: user.group_name } };
  });

  // GET /api/auth/me – my profile
  app.get('/me', { onRequest: [app.authenticate] }, async (request) => {
    const { rows } = await pool.query(`SELECT ${PROFILE}, created_at FROM users WHERE id = $1`, [request.user.id]);
    return rows[0];
  });

  // PATCH /api/auth/me { name?, group_name? } – update my profile
  app.patch('/me', {
    onRequest: [app.authenticate],
    schema: {
      body: {
        type: 'object', minProperties: 1,
        properties: { name: { type: 'string', minLength: 1, maxLength: 100 }, group_name: groupField }
      }
    }
  }, async (request, reply) => {
    const { name } = request.body;
    if (name !== undefined && !name.trim()) return reply.code(400).send({ message: 'Name is required.' });
    const changeGroup = Object.hasOwn(request.body, 'group_name');
    const { rows } = await pool.query(
      `UPDATE users SET name = COALESCE($2, name),
              group_name = CASE WHEN $3 THEN $4 ELSE group_name END
       WHERE id = $1 RETURNING ${PROFILE}`,
      [request.user.id, name?.trim() ?? null, changeGroup, cleanGroup(request.body.group_name)]
    );
    return rows[0];
  });

  // PATCH /api/auth/password { current_password, new_password }
  app.patch('/password', {
    onRequest: [app.authenticate],
    schema: {
      body: {
        type: 'object', required: ['current_password', 'new_password'],
        properties: {
          current_password: { type: 'string' },
          new_password: { type: 'string', minLength: 6, maxLength: 72 }
        }
      }
    }
  }, async (request, reply) => {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [request.user.id]);
    if (!rows[0] || !(await bcrypt.compare(request.body.current_password, rows[0].password_hash))) {
      return reply.code(400).send({ message: 'Your current password is not correct.' });
    }
    if (request.body.current_password === request.body.new_password) {
      return reply.code(400).send({ message: 'Choose a new password that is different from the current one.' });
    }
    const hash = await bcrypt.hash(request.body.new_password, 10);
    await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [request.user.id, hash]);
    return { message: 'Password changed.' };
  });
}
