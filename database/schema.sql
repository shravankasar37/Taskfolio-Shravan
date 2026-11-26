-- =====================================================================
-- To-Do App (GRP 10) — PostgreSQL schema
-- Tables: users (with User/Admin role) and tasks (each task belongs to a user)
--
-- Run this file while connected to the "todo_app" database:
--   psql -U postgres -d todo_app -f database/schema.sql
-- WARNING: it drops and re-creates the tables, so all existing data is lost.
-- Use it for local development only.
-- =====================================================================

DROP VIEW  IF EXISTS user_task_stats;
DROP TABLE IF EXISTS ai_runs;
DROP TABLE IF EXISTS notification_reads;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS users;
DROP FUNCTION IF EXISTS set_updated_at();

-- ---------------------------------------------------------------------
-- users: everyone who can log in. "role" decides User vs Admin.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash TEXT         NOT NULL,          -- bcrypt hash, never the plain password
    role          VARCHAR(10)  NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin')),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE, -- admin can deactivate a user ("Manage users")
    group_name    VARCHAR(50),                        -- e.g. 'GRP 10', used for group-wise notifications
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- One account per email, ignoring upper/lower case (Test@x.com = test@x.com)
CREATE UNIQUE INDEX users_email_unique ON users (LOWER(email));

-- ---------------------------------------------------------------------
-- tasks: every task belongs to exactly one user (user_id).
-- Deleting a user also deletes their tasks (ON DELETE CASCADE).
-- ---------------------------------------------------------------------
CREATE TABLE tasks (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title        VARCHAR(200) NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
    description  TEXT,
    status       VARCHAR(10)  NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'completed')),
    priority     VARCHAR(10)  NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low', 'medium', 'high')),
    due_date     DATE,
    estimated_minutes INTEGER CHECK (estimated_minutes BETWEEN 1 AND 10080), -- AI Time Estimator
    completed_at TIMESTAMPTZ,                     -- set when status becomes 'completed'
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fast lookups for "my tasks" and the Pending / Completed filters
CREATE INDEX tasks_user_id_idx        ON tasks (user_id);
CREATE INDEX tasks_user_id_status_idx ON tasks (user_id, status);

-- ---------------------------------------------------------------------
-- Group-wise notifications: admin sends to everyone (target_group NULL)
-- or to one group. notification_reads remembers who has read what.
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title        VARCHAR(120) NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
    message      TEXT         NOT NULL CHECK (LENGTH(TRIM(message)) > 0),
    target_group VARCHAR(50),
    created_by   INTEGER REFERENCES users (id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX notifications_target_group_idx ON notifications (target_group);

CREATE TABLE notification_reads (
    notification_id INTEGER     NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
    user_id         INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (notification_id, user_id)
);

-- ---------------------------------------------------------------------
-- AI runs: one row per Gemini / Grok call, used for the speed comparison
-- ---------------------------------------------------------------------
CREATE TABLE ai_runs (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER     REFERENCES users (id) ON DELETE SET NULL,
    feature    VARCHAR(40) NOT NULL,
    provider   VARCHAR(10) NOT NULL CHECK (provider IN ('gemini', 'grok')),
    model      VARCHAR(80),
    elapsed_ms INTEGER     NOT NULL,
    ok         BOOLEAN     NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ai_runs_feature_provider_idx ON ai_runs (feature, provider);

-- ---------------------------------------------------------------------
-- Keep updated_at correct automatically on every UPDATE
-- ---------------------------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- Admin dashboard: task statistics per user (read-only view)
--   SELECT * FROM user_task_stats;
-- ---------------------------------------------------------------------
CREATE VIEW user_task_stats AS
SELECT
    u.id                                              AS user_id,
    u.name,
    u.email,
    u.role,
    u.is_active,
    COUNT(t.id)                                       AS total_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'pending')   AS pending_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'completed') AS completed_tasks
FROM users u
LEFT JOIN tasks t ON t.user_id = u.id
GROUP BY u.id;
