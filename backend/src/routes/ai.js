import { pool } from '../db.js';
import { FEATURES, InputError } from '../ai/features.js';
import { PROVIDERS, ProviderError, isConfigured, mockMode, parseJson, runProvider } from '../ai/providers.js';
import { mockReply } from '../ai/mock.js';

export default async function aiRoutes(app) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/ai/features -> which features this user can use and which providers are configured
  app.get('/features', async (request) => ({
    mock: mockMode(),
    providers: Object.fromEntries(Object.entries(PROVIDERS).map(([id, p]) => [id, {
      label: p.label, model: p.model(), configured: mockMode() || isConfigured(id)
    }])),
    features: Object.entries(FEATURES)
      .filter(([, f]) => f.role === request.user.role)
      .map(([id, f]) => ({ id, label: f.label }))
  }));

  // POST /api/ai/:feature { provider: 'gemini' | 'grok', ...feature input }
  app.post('/:feature', {
    onRequest: [limitAiCalls],
    schema: {
      params: { type: 'object', properties: { feature: { type: 'string' } } },
      body: { type: 'object', required: ['provider'], properties: { provider: { type: 'string', enum: ['gemini', 'grok'] } } }
    }
  }, async (request, reply) => {
    const feature = FEATURES[request.params.feature];
    if (!feature) return reply.code(404).send({ message: 'Unknown AI feature.' });
    if (feature.role !== request.user.role) return reply.code(403).send({ message: `${feature.label} is only for ${feature.role}s.` });

    const { provider } = request.body;
    const mock = mockMode();
    if (!mock && !isConfigured(provider)) {
      return reply.code(503).send({ message: `${PROVIDERS[provider].label} is not set up yet. Add ${PROVIDERS[provider].keyName} to the backend environment.` });
    }

    let built;
    try {
      built = await feature.build({ user: request.user, body: request.body });
    } catch (error) {
      if (error instanceof InputError) return reply.code(400).send({ message: error.message });
      throw error;
    }

    let run;
    try {
      run = mock
        ? { model: 'mock', elapsedMs: provider === 'gemini' ? 420 : 610, text: mockReply(request.params.feature, provider, built.context) }
        : await runProvider(provider, built.prompt);
    } catch (error) {
      const elapsedMs = 0;
      await logRun(request, provider, PROVIDERS[provider].model(), elapsedMs, false, mock);
      const reason = error.name === 'TimeoutError' ? 'took too long (timeout)'
        : error instanceof ProviderError ? error.message : 'could not be reached';
      request.log.warn({ provider, reason, detail: error.detail }, 'AI provider failed');
      return reply.code(502).send({ message: `${PROVIDERS[provider].label} failed: ${reason}` });
    }

    let result;
    try {
      result = feature.clean(parseJson(run.text), built.context);
    } catch {
      await logRun(request, provider, run.model, run.elapsedMs, false, mock);
      return reply.code(502).send({ message: `${PROVIDERS[provider].label} replied, but not in the expected format. Try again.`, raw: run.text.slice(0, 600) });
    }

    await logRun(request, provider, run.model, run.elapsedMs, true, mock);
    return { feature: request.params.feature, provider, model: run.model, elapsedMs: run.elapsedMs, mock, result };
  });

  // GET /api/ai/stats -> average speed and success per feature and provider (admin: everyone, user: own runs)
  app.get('/stats', async (request) => {
    const admin = request.user.role === 'admin';
    const { rows } = await pool.query(
      `SELECT feature, provider, COUNT(*)::int AS runs,
              COUNT(*) FILTER (WHERE ok)::int AS ok_runs,
              ROUND(AVG(elapsed_ms) FILTER (WHERE ok))::int AS avg_ms,
              MIN(elapsed_ms) FILTER (WHERE ok)::int AS min_ms,
              MAX(elapsed_ms) FILTER (WHERE ok)::int AS max_ms
       FROM ai_runs WHERE ($1 OR user_id = $2)
       GROUP BY feature, provider ORDER BY feature, provider`, [admin, request.user.id]);
    return rows;
  });
}

// Simple in-memory limit: each user may make AI_CALLS_PER_MINUTE AI calls per minute (default 20).
const recentCalls = new Map();
async function limitAiCalls(request, reply) {
  const limit = Number(process.env.AI_CALLS_PER_MINUTE) || 20;
  const now = Date.now();
  const calls = (recentCalls.get(request.user.id) || []).filter(t => now - t < 60000);
  if (calls.length >= limit) {
    return reply.code(429).send({ message: 'Too many AI requests. Please wait a minute and try again.' });
  }
  calls.push(now);
  recentCalls.set(request.user.id, calls);
}

async function logRun(request, provider, model, elapsedMs, ok, mock) {
  if (mock) return; // mock runs never count in the comparison
  await pool.query(
    'INSERT INTO ai_runs (user_id, feature, provider, model, elapsed_ms, ok) VALUES ($1, $2, $3, $4, $5, $6)',
    [request.user.id, request.params.feature, provider, model, elapsedMs, ok]
  );
}
