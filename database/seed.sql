-- =====================================================================
-- To-Do App (GRP 10) — sample data for LOCAL TESTING ONLY
-- Run after schema.sql:
--   psql -U postgres -d todo_app -f database/seed.sql
--
-- Test logins (local only, never use these on a real server):
--   admin@todo.test  / Admin@123   (role: admin)
--   riya@todo.test   / User@123    (role: user)
--   aman@todo.test   / User@123    (role: user)
--
-- Passwords are hashed with bcrypt by PostgreSQL's pgcrypto extension,
-- so the backend can check them with bcrypt / bcryptjs compare().
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

TRUNCATE tasks, users RESTART IDENTITY CASCADE;

INSERT INTO users (name, email, password_hash, role) VALUES
    ('Admin',       'admin@todo.test', crypt('Admin@123', gen_salt('bf', 10)), 'admin'),
    ('Riya Sharma', 'riya@todo.test',  crypt('User@123',  gen_salt('bf', 10)), 'user'),
    ('Aman Patil',  'aman@todo.test',  crypt('User@123',  gen_salt('bf', 10)), 'user');

INSERT INTO tasks (user_id, title, description, status, priority, due_date, completed_at)
SELECT u.id, v.title, v.description, v.status, v.priority, v.due_date,
       CASE WHEN v.status = 'completed' THEN NOW() END
FROM (VALUES
    ('riya@todo.test', 'Finish Angular basics video', 'Phase 1 of the roadmap',        'completed', 'high',   CURRENT_DATE - 1),
    ('riya@todo.test', 'Buy groceries',               'Milk, bread, vegetables',       'pending',   'medium', CURRENT_DATE + 1),
    ('riya@todo.test', 'Prepare test cases',          'Login and Add Task screens',    'pending',   'high',   CURRENT_DATE + 2),
    ('aman@todo.test', 'Revise SQL JOINs',            NULL,                            'pending',   'low',    CURRENT_DATE + 3),
    ('aman@todo.test', 'Submit internship log',       'Update T-002 in the task sheet', 'completed', 'medium', CURRENT_DATE)
) AS v(email, title, description, status, priority, due_date)
JOIN users u ON u.email = v.email;
