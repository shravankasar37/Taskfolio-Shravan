-- =====================================================================
-- Migration 002 – Task 3 features (safe to run on an EXISTING database)
-- Adds: user groups, task time estimates, group-wise notifications, AI run log.
-- Does NOT delete any data. Safe to run more than once.
--
--   psql "$DATABASE_URL" -f database/migrations/002_task3_features.sql
-- =====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS group_name VARCHAR(50);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;
DO $$ BEGIN
    ALTER TABLE tasks ADD CONSTRAINT tasks_estimated_minutes_check
        CHECK (estimated_minutes BETWEEN 1 AND 10080);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS notifications (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title        VARCHAR(120) NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
    message      TEXT         NOT NULL CHECK (LENGTH(TRIM(message)) > 0),
    target_group VARCHAR(50),
    created_by   INTEGER REFERENCES users (id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_target_group_idx ON notifications (target_group);

CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id INTEGER     NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
    user_id         INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS ai_runs (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER     REFERENCES users (id) ON DELETE SET NULL,
    feature    VARCHAR(40) NOT NULL,
    provider   VARCHAR(10) NOT NULL CHECK (provider IN ('gemini', 'grok')),
    model      VARCHAR(80),
    elapsed_ms INTEGER     NOT NULL,
    ok         BOOLEAN     NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_runs_feature_provider_idx ON ai_runs (feature, provider);
