// LOCAL TESTING ONLY (AI_MOCK=true, never in production): fake replies in the same JSON shape the
// real models return, so the screens can be tested without API keys. Mock runs are never saved to
// ai_runs, so they can never end up in the Gemini vs Grok comparison.
import { today } from './features.js';

export function mockReply(feature, provider, ctx) {
  const tag = provider === 'gemini' ? 'Gemini' : 'Grok';
  const d = today();
  const replies = {
    'daily-planner': () => ({
      summary: `[MOCK ${tag}] Focus on your most urgent work first.`,
      plan: [
        ...(ctx.tasks || []).slice(0, 3).map((t, i) => ({ start: `${String(9 + i * 2).padStart(2, '0')}:00`, end: `${String(10 + i * 2).padStart(2, '0')}:30`, task_id: t.id, title: t.title, note: 'Mock note' })),
        { start: '13:00', end: '13:30', task_id: null, title: 'Break', note: 'Lunch' }
      ],
      not_scheduled: (ctx.tasks || []).slice(3).map(t => ({ task_id: t.id, reason: 'Mock: does not fit today' }))
    }),
    'overdue-rescue': () => ({
      summary: `[MOCK ${tag}] You can catch up.`,
      do_today: (ctx.tasks || []).slice(0, 1).map(t => ({ task_id: t.id, first_step: 'Open the task and do 10 minutes' })),
      reschedule: (ctx.tasks || []).slice(1).map(t => ({ task_id: t.id, new_due_date: d, reason: 'Mock reschedule' })),
      tips: ['Mock tip']
    }),
    'time-estimate': () => ({ estimated_minutes: provider === 'gemini' ? 60 : 75, confidence: 'medium', reasoning: `[MOCK ${tag}] Rough estimate.`, steps: [{ step: 'Mock step', minutes: 30 }] }),
    'weekly-report': () => ({ headline: `[MOCK ${tag}] Steady week.`, score: 70, highlights: ['Mock highlight'], concerns: ['Mock concern'], tips: ['Mock tip'] }),
    'due-date': () => ({ due_date: d, reason: `[MOCK ${tag}] Mock reason.` }),
    'description': () => ({ description: `[MOCK ${tag}] Mock goal.`, checklist: ['Mock step 1', 'Mock step 2'] }),
    'ask': () => ({ answer: `[MOCK ${tag}] Mock answer.`, task_ids: (ctx.tasks || []).slice(0, 2).map(t => t.id) }),
    'notification-writer': () => ({ title: `[MOCK ${tag}] Update`, message: 'Mock announcement.', tone_notes: 'Mock notes' })
  };
  return JSON.stringify(replies[feature]());
}
