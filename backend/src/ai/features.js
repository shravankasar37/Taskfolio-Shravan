import { pool } from '../db.js';

// ---------------------------------------------------------------------------------------------
// Each feature: load the user's data from the database (never trust the browser for it),
// build ONE prompt (the same text goes to Gemini and Groq), then check and clean the AI reply.
// ---------------------------------------------------------------------------------------------

const TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const addDays = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
const weekday = date => new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isTime = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const text = (v, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v, max = 8) => (Array.isArray(v) ? v : []).map(x => text(x, 300)).filter(Boolean).slice(0, max);
const int = v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);

export class InputError extends Error {}

function jsonRules(shape) {
  return `\n\nReply with ONLY one valid JSON object, no markdown, no extra text. Use exactly this shape:\n${shape}`;
}

async function pendingTasks(userId) {
  const { rows } = await pool.query(
    `SELECT id, title, description, priority, due_date, estimated_minutes FROM tasks
     WHERE user_id = $1 AND status = 'pending' ORDER BY due_date NULLS LAST, id LIMIT 60`, [userId]);
  return rows;
}
const taskLine = t => `#${t.id} "${t.title}" | priority: ${t.priority} | due: ${t.due_date || 'none'}`
  + (t.estimated_minutes ? ` | estimate: ${t.estimated_minutes} min` : '')
  + (t.description ? ` | notes: ${t.description.slice(0, 160).replace(/\s+/g, ' ')}` : '');

// ============================== 1. AI Daily Planner ==============================
const dailyPlanner = {
  label: 'AI Daily Planner',
  role: 'user',
  async build({ user, body }) {
    const start = isTime(body.start_time) ? body.start_time : '09:00';
    const end = isTime(body.end_time) ? body.end_time : '18:00';
    if (start >= end) throw new InputError('End time must be after start time.');
    const tasks = await pendingTasks(user.id);
    if (!tasks.length) throw new InputError('You have no pending tasks to plan.');
    const d = today();
    return {
      context: { tasks, start, end },
      prompt: `You are a productivity assistant. Create a realistic plan for ${weekday(d)} ${d} for this person.
Working hours: ${start} to ${end}. Include short breaks. Put overdue and high-priority tasks first, respect due dates,
use the given time estimates when present, and do not overload the day – leave tasks for later if they do not fit.

Pending tasks:
${tasks.map(taskLine).join('\n')}` + jsonRules(`{
  "summary": "one or two sentences about the day",
  "plan": [ { "start": "HH:MM", "end": "HH:MM", "task_id": 12, "title": "task title (for a break use task_id null and title Break)", "note": "why / what to focus on" } ],
  "not_scheduled": [ { "task_id": 15, "title": "...", "reason": "why it waits" } ]
}`)
    };
  },
  clean(json, { tasks, start, end }) {
    const ids = new Map(tasks.map(t => [t.id, t.title]));
    const plan = (Array.isArray(json.plan) ? json.plan : [])
      .filter(s => isTime(s.start) && isTime(s.end) && s.start < s.end && s.start >= start && s.end <= end)
      .map(s => ({ start: s.start, end: s.end, task_id: ids.has(int(s.task_id)) ? int(s.task_id) : null,
        title: ids.get(int(s.task_id)) || text(s.title, 120) || 'Break', note: text(s.note, 240) }))
      .sort((a, b) => a.start.localeCompare(b.start)).slice(0, 24);
    const notScheduled = (Array.isArray(json.not_scheduled) ? json.not_scheduled : [])
      .filter(s => ids.has(int(s.task_id)))
      .map(s => ({ task_id: int(s.task_id), title: ids.get(int(s.task_id)), reason: text(s.reason, 200) }));
    if (!plan.length) throw new SyntaxError('The plan had no valid time slots');
    return { summary: text(json.summary, 400), plan, not_scheduled: notScheduled };
  }
};

// ============================== 2. AI Overdue Rescue Plan ==============================
const overdueRescue = {
  label: 'AI Overdue Rescue Plan',
  role: 'user',
  async build({ user }) {
    const d = today();
    const tasks = (await pendingTasks(user.id)).filter(t => t.due_date && t.due_date < d);
    if (!tasks.length) throw new InputError('Great news – you have no overdue tasks!');
    const upcoming = (await pendingTasks(user.id)).filter(t => !t.due_date || t.due_date >= d);
    return {
      context: { tasks, d },
      prompt: `You are a supportive productivity coach. Today is ${weekday(d)} ${d}. This person has overdue tasks.
Make a realistic recovery plan: pick at most 3 overdue tasks to finish TODAY (most important first, each with a
concrete first step), and give every other overdue task a new realistic due date (on or after ${d}) that does not
pile everything on one day. Consider their upcoming workload.

Overdue tasks:
${tasks.map(taskLine).join('\n')}

Upcoming tasks (workload):
${upcoming.slice(0, 25).map(taskLine).join('\n') || 'none'}` + jsonRules(`{
  "summary": "short encouraging summary",
  "do_today": [ { "task_id": 3, "title": "...", "first_step": "the very first action" } ],
  "reschedule": [ { "task_id": 4, "title": "...", "new_due_date": "YYYY-MM-DD", "reason": "..." } ],
  "tips": [ "short tip" ]
}`)
    };
  },
  clean(json, { tasks, d }) {
    const ids = new Map(tasks.map(t => [t.id, t.title]));
    const doToday = (Array.isArray(json.do_today) ? json.do_today : []).filter(x => ids.has(int(x.task_id)))
      .slice(0, 3).map(x => ({ task_id: int(x.task_id), title: ids.get(int(x.task_id)), first_step: text(x.first_step, 240) }));
    const reschedule = (Array.isArray(json.reschedule) ? json.reschedule : [])
      .filter(x => ids.has(int(x.task_id)) && isDate(x.new_due_date) && x.new_due_date >= d && x.new_due_date <= addDays(d, 365))
      .map(x => ({ task_id: int(x.task_id), title: ids.get(int(x.task_id)), new_due_date: x.new_due_date, reason: text(x.reason, 200) }));
    return { summary: text(json.summary, 400), do_today: doToday, reschedule, tips: list(json.tips, 5) };
  }
};

// ============================== 3. AI Time Estimator ==============================
const timeEstimate = {
  label: 'AI Time Estimator',
  role: 'user',
  async build({ user, body }) {
    let task = { title: text(body.title, 200), description: text(body.description, 1000), id: null };
    if (body.task_id != null) {
      const { rows } = await pool.query('SELECT id, title, description FROM tasks WHERE id = $1 AND user_id = $2', [int(body.task_id), user.id]);
      if (!rows[0]) throw new InputError('Task not found.');
      task = rows[0];
    }
    if (!task.title) throw new InputError('Enter a task title or choose a task.');
    return {
      context: { task },
      prompt: `Estimate how long this task will take one focused student/intern, in minutes. Be realistic, include
small overheads, and split it into a few steps that add up to the total. "confidence" must be "low", "medium" or "high".

Task: "${task.title}"${task.description ? `\nDetails: ${task.description}` : ''}` + jsonRules(`{
  "estimated_minutes": 90,
  "confidence": "medium",
  "reasoning": "one or two sentences",
  "steps": [ { "step": "...", "minutes": 30 } ]
}`)
    };
  },
  clean(json, { task }) {
    const minutes = int(json.estimated_minutes);
    if (!minutes || minutes < 1) throw new SyntaxError('No valid estimate');
    const steps = (Array.isArray(json.steps) ? json.steps : []).map(s => ({ step: text(s.step, 160), minutes: Math.max(0, int(s.minutes) || 0) }))
      .filter(s => s.step).slice(0, 8);
    return { task_id: task.id, title: task.title, estimated_minutes: Math.min(minutes, 10080),
      confidence: ['low', 'medium', 'high'].includes(json.confidence) ? json.confidence : 'medium',
      reasoning: text(json.reasoning, 400), steps };
  }
};

// ============================== 4. AI Weekly Progress Report ==============================
const weeklyReport = {
  label: 'AI Weekly Progress Report',
  role: 'user',
  async build({ user }) {
    const d = today();
    const from = addDays(d, -6);
    const { rows: done } = await pool.query(
      `SELECT title, priority, due_date, (completed_at AT TIME ZONE $3)::date AS done_on FROM tasks
       WHERE user_id = $1 AND status = 'completed' AND (completed_at AT TIME ZONE $3)::date >= $2::date
       ORDER BY completed_at`, [user.id, from, TZ]);
    const { rows: [counts] } = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
              COUNT(*) FILTER (WHERE status = 'pending' AND due_date < $2::date)::int AS overdue,
              COUNT(*) FILTER (WHERE (created_at AT TIME ZONE $3)::date >= $4::date)::int AS created
       FROM tasks WHERE user_id = $1`, [user.id, d, TZ, from]);
    if (!done.length && !counts.pending) throw new InputError('Add and complete some tasks first – then your weekly report will have something to say.');
    const late = done.filter(t => t.due_date && t.done_on > t.due_date).length;
    const byDay = {};
    for (const t of done) byDay[weekday(t.done_on)] = (byDay[weekday(t.done_on)] || 0) + 1;
    const stats = { period: `${from} to ${d}`, completed: done.length, completed_late: late, created: counts.created,
      still_pending: counts.pending, overdue_now: counts.overdue, completed_by_day: byDay,
      completed_high_priority: done.filter(t => t.priority === 'high').length };
    return {
      context: { stats },
      prompt: `You are a friendly productivity coach. Write a short weekly progress report for this person from
their real statistics. Be specific to the numbers, honest about problems, and positive. Give practical tips.

Statistics (last 7 days):
${JSON.stringify(stats, null, 2)}

Tasks completed: ${done.map(t => `"${t.title}" (${t.priority})`).join(', ') || 'none'}` + jsonRules(`{
  "headline": "one-line summary of the week",
  "score": 0-100 productivity score,
  "highlights": [ "what went well" ],
  "concerns": [ "what needs attention" ],
  "tips": [ "practical tip for next week" ]
}`)
    };
  },
  clean(json, { stats }) {
    const score = int(json.score);
    return { headline: text(json.headline, 200), score: score === null ? null : Math.max(0, Math.min(100, score)),
      highlights: list(json.highlights, 5), concerns: list(json.concerns, 5), tips: list(json.tips, 5), stats };
  }
};

// ============================== 5. Smart Due-Date Suggester ==============================
const dueDate = {
  label: 'Smart Due-Date Suggester',
  role: 'user',
  async build({ user, body }) {
    const title = text(body.title, 200);
    if (!title) throw new InputError('Enter the task title first.');
    const priority = ['low', 'medium', 'high'].includes(body.priority) ? body.priority : 'medium';
    const d = today();
    const { rows } = await pool.query(
      `SELECT due_date, COUNT(*)::int AS tasks FROM tasks WHERE user_id = $1 AND status = 'pending'
       AND due_date BETWEEN $2::date AND $2::date + 21 GROUP BY due_date ORDER BY due_date`, [user.id, d]);
    return {
      context: { d },
      prompt: `Suggest a realistic due date for a new task. Today is ${weekday(d)} ${d}. Consider the priority
(high = soon, low = can wait), how big the task sounds, and avoid days that are already busy.

New task: "${title}" | priority: ${priority}${body.description ? ` | details: ${text(body.description, 500)}` : ''}

Existing pending tasks per due date (next 3 weeks):
${rows.map(r => `${r.due_date} (${weekday(r.due_date)}): ${r.tasks} task(s)`).join('\n') || 'no other tasks scheduled'}` + jsonRules(`{
  "due_date": "YYYY-MM-DD",
  "reason": "one sentence"
}`)
    };
  },
  clean(json, { d }) {
    if (!isDate(json.due_date) || json.due_date < d || json.due_date > addDays(d, 365)) throw new SyntaxError('No valid future date');
    return { due_date: json.due_date, weekday: weekday(json.due_date), reason: text(json.reason, 300) };
  }
};

// ============================== 6. AI Task Description Writer ==============================
const description = {
  label: 'AI Task Description Writer',
  role: 'user',
  async build({ body }) {
    const title = text(body.title, 200);
    if (!title) throw new InputError('Enter the task title first.');
    return {
      context: {},
      prompt: `Write a clear, short description for this to-do task so anyone reading it knows exactly what to do.
Include the goal in one sentence and a checklist of 3-6 concrete steps. Keep it practical and under 80 words.

Task title: "${title}"${body.priority ? ` (priority: ${text(body.priority, 10)})` : ''}` + jsonRules(`{
  "description": "one-sentence goal",
  "checklist": [ "step 1", "step 2" ]
}`)
    };
  },
  clean(json) {
    const checklist = list(json.checklist, 6);
    const goal = text(json.description, 400);
    if (!goal && !checklist.length) throw new SyntaxError('Empty description');
    return { description: goal, checklist, full_text: [goal, ...checklist.map(s => '• ' + s)].filter(Boolean).join('\n') };
  }
};

// ============================== 7. Ask Your Tasks ==============================
const ask = {
  label: 'Ask Your Tasks',
  role: 'user',
  async build({ user, body }) {
    const question = text(body.question, 300);
    if (!question) throw new InputError('Type a question, e.g. "What is due this week?"');
    const { rows: tasks } = await pool.query(
      `SELECT id, title, status, priority, due_date, (completed_at AT TIME ZONE $2)::date AS completed_on
       FROM tasks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`, [user.id, TZ]);
    const d = today();
    return {
      context: { tasks },
      prompt: `Answer the user's question using ONLY their task list below. Today is ${weekday(d)} ${d}.
If the answer is not in the tasks, say so. Keep the answer short and friendly, and list the task ids you used.

Question: "${question}"

Tasks:
${tasks.map(t => `#${t.id} "${t.title}" | ${t.status}${t.completed_on ? ` on ${t.completed_on}` : ''} | priority: ${t.priority} | due: ${t.due_date || 'none'}`).join('\n') || 'no tasks'}` + jsonRules(`{
  "answer": "short answer",
  "task_ids": [ 3, 7 ]
}`)
    };
  },
  clean(json, { tasks }) {
    const byId = new Map(tasks.map(t => [t.id, t]));
    const ids = [...new Set((Array.isArray(json.task_ids) ? json.task_ids : []).map(int).filter(id => byId.has(id)))].slice(0, 15);
    if (!text(json.answer)) throw new SyntaxError('Empty answer');
    return { answer: text(json.answer, 800), tasks: ids.map(id => ({ id, title: byId.get(id).title, status: byId.get(id).status, due_date: byId.get(id).due_date })) };
  }
};

// ============================== 8. AI Notification Writer (admin) ==============================
const notificationWriter = {
  label: 'AI Notification Writer',
  role: 'admin',
  async build({ body }) {
    const draft = text(body.draft, 1000);
    if (!draft) throw new InputError('Write a rough note of what you want to announce.');
    const tone = ['friendly', 'formal', 'urgent'].includes(body.tone) ? body.tone : 'friendly';
    const audience = text(body.audience, 50) || 'all users';
    return {
      context: {},
      prompt: `Rewrite this rough note into a clear, polite announcement for interns using a to-do app.
Tone: ${tone}. Audience: ${audience}. Keep the original meaning, fix grammar, keep it under 60 words, and
include any dates or deadlines from the note. Also give a short title.

Rough note: "${draft}"` + jsonRules(`{
  "title": "max 8 words",
  "message": "the announcement",
  "tone_notes": "what you improved, one sentence"
}`)
    };
  },
  clean(json) {
    if (!text(json.title) || !text(json.message)) throw new SyntaxError('Missing title or message');
    return { title: text(json.title, 120), message: text(json.message, 2000), tone_notes: text(json.tone_notes, 300) };
  }
};

export const FEATURES = {
  'daily-planner': dailyPlanner,
  'overdue-rescue': overdueRescue,
  'time-estimate': timeEstimate,
  'weekly-report': weeklyReport,
  'due-date': dueDate,
  'description': description,
  'ask': ask,
  'notification-writer': notificationWriter
};
