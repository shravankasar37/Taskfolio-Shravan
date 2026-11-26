import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AiInfo, AiResponse, AiStat, Api, Draft, Provider, Task } from '../services/api';

type RunState = { state: 'loading' | 'done' | 'error'; data?: AiResponse; error?: string };

// Short explanation and icon for every AI feature shown in the assistant.
const ABOUT: Record<string, { icon: string; hint: string }> = {
  'daily-planner': { icon: '🗓️', hint: 'Turns your pending tasks into a time-slotted plan for today.' },
  'overdue-rescue': { icon: '🛟', hint: 'Picks what to finish today and gives overdue tasks realistic new dates.' },
  'time-estimate': { icon: '⏱️', hint: 'Estimates how long a task will take, step by step.' },
  'weekly-report': { icon: '📈', hint: 'Your last 7 days in numbers, with highlights and tips.' },
  'due-date': { icon: '📅', hint: 'Suggests a sensible due date for a new task based on your workload.' },
  'description': { icon: '📝', hint: 'Writes a clear description and checklist from a short title.' },
  'ask': { icon: '💬', hint: 'Ask about your tasks in plain English, e.g. "What is due this week?"' },
  'notification-writer': { icon: '📣', hint: 'Turns a rough note into a clear, polite announcement.' }
};

@Component({
  selector: 'ai-assistant', standalone: true, imports: [FormsModule], templateUrl: './ai-assistant.html'
})
export class AiAssistant {
  api = inject(Api);
  @Input() tasks: Task[] = [];
  @Output() tasksChanged = new EventEmitter<void>();
  @Output() useDraft = new EventEmitter<Partial<Draft>>();
  @Output() useNotification = new EventEmitter<{ title: string; message: string }>();

  readonly providers: Provider[] = ['gemini', 'grok'];
  about = ABOUT;
  info?: AiInfo;
  infoError = '';
  feature = '';
  results: Partial<Record<Provider, RunState>> = {};
  stats: AiStat[] = [];
  notice = '';
  applying = false;
  input = {
    start_time: '09:00', end_time: '18:00', task_id: null as number | null, title: '', priority: 'medium',
    description: '', question: '', draft: '', tone: 'friendly', audience: 'all users'
  };

  get pending() { return this.tasks.filter(t => t.status === 'pending'); }
  get running() { return Object.values(this.results).some(r => r?.state === 'loading'); }
  get label() { return this.info?.features.find(f => f.id === this.feature)?.label ?? ''; }
  get faster(): Provider | null {
    const g = this.results.gemini, x = this.results.grok;
    if (g?.state !== 'done' || x?.state !== 'done' || !g.data || !x.data) return null;
    return g.data.elapsedMs <= x.data.elapsedMs ? 'gemini' : 'grok';
  }

  async ngOnInit() {
    try {
      this.info = await this.api.aiInfo();
      this.feature = this.info.features[0]?.id ?? '';
      void this.loadStats();
    } catch (err) {
      this.infoError = this.message(err);
    }
  }

  select(id: string) { this.feature = id; this.results = {}; this.notice = ''; }

  async run(providers: Provider[]) {
    if (this.running) return;
    this.notice = '';
    this.results = {};
    const body = this.bodyFor(this.feature);
    // Compare mode sends both requests at the same time with exactly the same input.
    await Promise.all(providers.map(async provider => {
      this.results[provider] = { state: 'loading' };
      try {
        this.results[provider] = { state: 'done', data: await this.api.aiRun(this.feature, provider, body) };
      } catch (err) {
        this.results[provider] = { state: 'error', error: this.message(err) };
      }
    }));
    void this.loadStats();
  }

  private bodyFor(feature: string): Record<string, unknown> {
    const i = this.input;
    switch (feature) {
      case 'daily-planner': return { start_time: i.start_time, end_time: i.end_time };
      case 'time-estimate': return i.task_id ? { task_id: i.task_id } : { title: i.title, description: i.description };
      case 'due-date': return { title: i.title, priority: i.priority, description: i.description };
      case 'description': return { title: i.title, priority: i.priority };
      case 'ask': return { question: i.question };
      case 'notification-writer': return { draft: i.draft, tone: i.tone, audience: i.audience };
      default: return {};
    }
  }

  canRun() {
    const i = this.input;
    switch (this.feature) {
      case 'time-estimate': return !!i.task_id || !!i.title.trim();
      case 'due-date': case 'description': return !!i.title.trim();
      case 'ask': return !!i.question.trim();
      case 'notification-writer': return !!i.draft.trim();
      default: return true;
    }
  }

  // ----- actions on a result -----
  async applyReschedule(r: AiResponse) {
    await this.apply(async () => {
      for (const s of r.result.reschedule) await this.api.patchTask(s.task_id, { due_date: s.new_due_date });
      this.notice = `Updated ${r.result.reschedule.length} due date(s) using ${this.providerName(r.provider)}'s plan.`;
    });
  }
  async saveEstimate(r: AiResponse) {
    await this.apply(async () => {
      await this.api.patchTask(r.result.task_id, { estimated_minutes: r.result.estimated_minutes });
      this.notice = `Saved ${this.duration(r.result.estimated_minutes)} as the estimate for "${r.result.title}".`;
    });
  }
  useDescription(r: AiResponse) {
    this.useDraft.emit({ title: this.input.title.trim(), description: r.result.full_text, priority: this.input.priority as Draft['priority'] });
  }
  useDueDate(r: AiResponse) {
    this.useDraft.emit({ title: this.input.title.trim(), due_date: r.result.due_date, priority: this.input.priority as Draft['priority'],
      ...(this.input.description.trim() ? { description: this.input.description.trim() } : {}) });
  }
  private async apply(action: () => Promise<void>) {
    if (this.applying) return;
    this.applying = true; this.notice = '';
    try { await action(); this.tasksChanged.emit(); }
    catch (err) { this.notice = this.message(err); }
    finally { this.applying = false; }
  }

  // ----- comparison stats -----
  async loadStats() {
    try { this.stats = await this.api.aiStats(); } catch { /* stats are optional */ }
  }
  statFeatures() { return [...new Set(this.stats.map(s => s.feature))]; }
  stat(feature: string, provider: Provider) { return this.stats.find(s => s.feature === feature && s.provider === provider); }
  featureLabel(id: string) { return this.info?.features.find(f => f.id === id)?.label ?? id; }

  // ----- helpers -----
  providerName(p: Provider) { return this.info?.providers[p].label ?? p; }
  seconds(ms: number | null | undefined) { return ms == null ? '–' : (ms / 1000).toFixed(2) + ' s'; }
  duration(min: number) { return min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}` : `${min} min`; }
  taskTitle(id: number | null) { return this.tasks.find(t => t.id === id)?.title ?? ''; }
  private message(err: unknown) {
    if (err instanceof HttpErrorResponse) return err.error?.message || 'The AI request failed. Check the server and try again.';
    return err instanceof Error ? err.message : 'Something went wrong.';
  }
}
