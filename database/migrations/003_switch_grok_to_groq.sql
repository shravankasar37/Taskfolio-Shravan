-- =====================================================================
-- Migration 003 – second AI provider is now Groq (was Grok / xAI)
-- Run this only on a database that already ran migration 002 with 'grok'.
-- Old 'grok' rows are failed test runs, so they are removed. Safe to run more than once.
--
--   psql "$DATABASE_URL" -f database/migrations/003_switch_grok_to_groq.sql
-- =====================================================================

ALTER TABLE ai_runs DROP CONSTRAINT IF EXISTS ai_runs_provider_check;
DELETE FROM ai_runs WHERE provider NOT IN ('gemini', 'groq');
ALTER TABLE ai_runs ADD CONSTRAINT ai_runs_provider_check CHECK (provider IN ('gemini', 'groq'));
