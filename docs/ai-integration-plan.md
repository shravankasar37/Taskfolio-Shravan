# AI Integration Plan – Gemini vs Grok (Task 3, GRP 10)

Owner: Shravan Sunil Kasar (Group Leader) · Created: 26-Nov-2026 · Deadline: **end of this week**
(comparison document: **by Sunday**)

> **Update 27-Nov-2026:** the second provider is now **Groq** (free, model `openai/gpt-oss-20b`) instead of
> Grok (xAI needs paid credits). Code, env names (`GROQ_API_KEY`, `GROQ_MODEL`) and the UI use Groq;
> this plan below still says Grok where it was written before the switch.

## 1. Rules from Vyas sir

1. **Individual task.** Each intern forks the repo to their own GitHub, hosts their **own** copy, and adds their **own** AI feature.
   The group leader does not host for everyone.
2. **Finish the meeting changes first** – dark mode, group-wise notifications, user/admin login updates
   (see `docs/new-features-plan.md`) – and fix bugs.
3. **One different feature per member** – no duplicates in the group.
4. **Same feature, both APIs:** implement it with **Gemini** *and* **Grok**, use the **same prompt/input**, and compare.
5. **Simple API integration only** – no AI agents.
6. Fill the group comparison document with **real test results**, not assumptions.

## 2. Feature assignment

| Member | Feature | Input → Output |
|---|---|---|
| Shravan | **AI Daily Planner** | My pending tasks (title, priority, due date) + working hours → a time-slotted plan for today |
| Archit | **Natural Language Task Creation** | "Submit report tomorrow 5 pm, high priority" → `{title, due_date, priority, description}` filled into the Add-task form |
| Adwaith | **AI Task Breakdown** | One big task → 3–7 smaller subtasks (can be added as tasks with one click) |
| Vaishnavi | **AI Smart Prioritizer** | All pending tasks → ranked order with a one-line reason for each |
| Suwaid | **AI Admin Insights** | Team statistics (per-user totals, pending, overdue) → short summary for the admin: progress, who is behind, suggestions |

Want a different feature? Tell the group leader first so nobody repeats.

## 3. How it fits into our app

```
Angular button "Generate with Gemini" / "Generate with Grok"
        │  POST /api/ai/<feature>   { provider: "gemini" | "grok", ...input }
        ▼
Fastify backend  (backend/src/routes/ai.js)
        │  builds ONE prompt → calls the chosen provider → measures time
        ▼
Gemini API  or  Grok (xAI) API
        │
        ▼
{ provider, model, elapsedMs, result }  → shown side by side in the UI
```

- **Keys never go to the browser.** The frontend only calls our backend; the backend holds the keys.
- Both providers get the **exact same prompt** from one shared function, so the comparison is fair.
- The backend measures `elapsedMs` with `performance.now()` around the API call (that's the "Response speed").

## 4. Getting API keys

| Provider | Where | Env variable |
|---|---|---|
| Gemini | aistudio.google.com → **Get API key** | `GEMINI_API_KEY` |
| Grok (xAI) | console.x.ai → **API keys** (may need credits on the account) | `XAI_API_KEY` |

Put them in `backend/.env` locally and in **Render → Environment** for your hosted copy.
⚠️ Never commit keys, never paste them in WhatsApp. `.env` is already in `.gitignore`.

## 5. API calls (Node.js 22 – built-in `fetch`, no extra packages)

Model names change – check each console for the current fast model and put it in env
(`GEMINI_MODEL`, `XAI_MODEL`).

```js
// Gemini
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent`,
  { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
const text = (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text;

// Grok (xAI – OpenAI-compatible)
const res2 = await fetch('https://api.x.ai/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.XAI_API_KEY}` },
  body: JSON.stringify({ model: process.env.XAI_MODEL, messages: [{ role: 'user', content: prompt }] }) });
const text2 = (await res2.json()).choices?.[0]?.message?.content;
```

Good practice: 20-second timeout (`AbortSignal.timeout(20000)`), friendly error message if a key is missing or the
API fails, ask the model to reply in **JSON** so the app can display it reliably.

## 6. Steps for every member

1. Fork / copy the repo, run it locally, finish `docs/new-features-plan.md`.
2. Create both API keys, add them to `backend/.env`.
3. Add `backend/src/routes/ai.js` with one route for your feature and register it in `server.js` (`/api/ai`).
4. Add the UI: input + **Generate with Gemini** + **Generate with Grok** buttons, show both results and their time.
5. Test with **at least 3 different inputs**, same input for both APIs. Note time, accuracy, clarity each time.
6. Deploy your copy (Render + Neon), add the keys in Render → Environment, test the live link.
7. Fill your row in the group comparison document.
8. Update your Daily Log every day.

## 7. Comparison – what to record (same input for both)

| Point | How to measure |
|---|---|
| **Response speed** | `elapsedMs` shown in the app, in seconds (average of 3 runs) |
| **Accuracy** | Was the output correct and relevant to the feature? (e.g. correct date extracted, sensible subtasks) |
| **Clarity** | Easy to read, well organised, followed the requested format? |
| **Better API** | Which one + one-line reason based on your results |

## 8. Done checklist (per member)

- [ ] Meeting changes done and tested
- [ ] AI feature works with **both** Gemini and Grok
- [ ] Same prompt used for both; time shown in the UI
- [ ] Keys only in `.env` / Render, nothing secret in GitHub
- [ ] Own hosted link working
- [ ] Comparison row filled (real results)
- [ ] Daily Log updated
