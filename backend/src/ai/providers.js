// Calls Gemini or Grok with the SAME prompt text and returns the reply + how long it took.
// Keys come only from environment variables (backend/.env locally, Render → Environment when hosted).

export const PROVIDERS = {
  gemini: {
    label: 'Gemini',
    keyName: 'GEMINI_API_KEY',
    model: () => process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    async call(prompt, model, signal) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ProviderError(data?.error?.message || `HTTP ${res.status}`, res.status);
      const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      if (!text) throw new ProviderError(`Empty reply (${data.candidates?.[0]?.finishReason || 'no content'})`);
      return text;
    }
  },
  grok: {
    label: 'Grok',
    keyName: 'XAI_API_KEY',
    model: () => process.env.XAI_MODEL || 'grok-3-mini',
    async call(prompt, model, signal) {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.XAI_API_KEY}` },
        body: JSON.stringify({ model, temperature: 0.4, messages: [{ role: 'user', content: prompt }] })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ProviderError(data?.error?.message || data?.error || `HTTP ${res.status}`, res.status);
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new ProviderError('Empty reply');
      return text;
    }
  }
};

export class ProviderError extends Error {
  constructor(message, status) { super(String(message).slice(0, 300)); this.upstreamStatus = status; }
}

export function isConfigured(provider) {
  return Boolean(process.env[PROVIDERS[provider].keyName]);
}

export function mockMode() {
  return process.env.AI_MOCK === 'true' && process.env.NODE_ENV !== 'production';
}

// Pulls the JSON object out of a reply (models sometimes wrap it in ```json fences or add a sentence).
export function parseJson(text) {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(cleaned); } catch { /* try the outermost {...} below */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new SyntaxError('No JSON object in reply');
}

// Runs one provider and measures the time of the API call only.
export async function runProvider(provider, prompt) {
  const p = PROVIDERS[provider];
  const model = p.model();
  const started = performance.now();
  const text = await p.call(prompt, model, AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 30000));
  const elapsedMs = Math.round(performance.now() - started);
  return { model, elapsedMs, text };
}
