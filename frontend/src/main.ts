import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Api, AppNotification, Draft, Group, SentNotification, Task, User } from '../services/api';
import { AiAssistant } from './ai-assistant';

function emptyTask(): Draft {
  return {title: '', description: '', priority: 'medium', due_date: null, status: 'pending', estimated_minutes: null};
}
const themeKey = 'taskfolio.theme';
type Theme = 'light' | 'dark';
function todayIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
}

@Component({
  selector: 'app-root', standalone: true, imports: [FormsModule, DatePipe, AiAssistant], templateUrl: './app.html'
})
class App {
  api = inject(Api);
  private titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  // ----- sign-in -----
  register = false;
  loginAs: 'user' | 'admin' = 'user';
  showPassword = false;
  confirmation = '';
  email = ''; password = ''; name = ''; groupName = '';
  readonly groupOptions = Array.from({length: 19}, (_, i) => 'GRP ' + (i + 1));
  // ----- general -----
  theme: Theme = this.initialTheme();
  view: 'dashboard' | 'profile' = 'dashboard';
  busy = false; notice = ''; error = ''; loaded = false;
  // ----- tasks -----
  editorOpen = false;
  tasksUnavailable = false; usersUnavailable = false;
  tasks: Task[] = []; users: User[] = [];
  filter = 'all'; query = '';
  ownerId: number | null = null;
  ownerLabels = new Map<number, string>();
  sort = 'default';
  draft = emptyTask(); editing?: number;
  // ----- admin user management -----
  renamingId?: number;
  displayName = '';
  deactivatingId?: number;
  // ----- notifications -----
  notifications: AppNotification[] = [];
  bellOpen = false;
  groups: Group[] = [];
  sent: SentNotification[] = [];
  compose = {title: '', message: '', target: null as string | null};
  // ----- profile -----
  profile = {name: '', group: '', current: '', next: '', confirm: ''};

  get admin() { return this.api.session?.user.role === 'admin'; }
  get otherUsers() { return this.users.filter(user => user.id !== this.api.session?.user.id); }
  get completed() { return this.tasks.filter(t => t.status === 'completed').length; }
  get unread() { return this.notifications.filter(n => !n.read).length; }
  get alerts() {
    const today = todayIso();
    const tomorrow = new Date(Date.parse(today + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
    const pending = this.tasks.filter(t => t.status === 'pending' && t.due_date);
    return {
      overdue: pending.filter(t => t.due_date!.slice(0, 10) < today),
      today: pending.filter(t => t.due_date!.slice(0, 10) === today),
      tomorrow: pending.filter(t => t.due_date!.slice(0, 10) === tomorrow)
    };
  }
  get alertCount() { const a = this.alerts; return a.overdue.length + a.today.length + a.tomorrow.length; }
  get visible() {
    const matches = this.tasks.filter(t => (this.filter === 'all' || t.status === this.filter)
      && (this.ownerId === null || t.user_id === this.ownerId)
      && t.title.toLowerCase().includes(this.query.trim().toLowerCase()));
    if (this.sort === 'due') {
      return matches.sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
    }
    if (this.sort === 'title') return matches.sort((a, b) => a.title.localeCompare(b.title));
    return matches;
  }

  ngOnInit() {
    this.applyTheme();
    if (this.api.session) void this.reload();
  }

  // ----- dark mode -----
  private initialTheme(): Theme {
    try {
      const saved = localStorage.getItem(themeKey);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* storage unavailable */ }
    return matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  private applyTheme() { document.documentElement.dataset['theme'] = this.theme; }
  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme();
    try { localStorage.setItem(themeKey, this.theme); } catch { /* storage unavailable */ }
  }

  async run(action: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true; this.error = ''; this.notice = '';
    try { await action(); }
    catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401 && this.api.session) this.logout();
      this.error = this.message(err);
    } finally { this.busy = false; }
  }
  private message(err: unknown) {
    return err instanceof HttpErrorResponse
      ? (err.error?.message || 'Request failed. Check your details and the API connection.')
      : err instanceof Error ? err.message : 'Request failed.';
  }

  async refresh() {
    this.loaded = false;
    this.tasksUnavailable = false;
    this.usersUnavailable = false;
    if (!this.admin) {
      const [tasks, notes] = await Promise.allSettled([this.api.myTasks(), this.api.notifications()]);
      if (tasks.status === 'rejected') throw tasks.reason;
      this.tasks = tasks.value;
      this.notifications = notes.status === 'fulfilled' ? notes.value : [];
      this.loaded = true;
      return;
    }
    const [tasks, users, groups, sent] = await Promise.allSettled(
      [this.api.allTasks(), this.api.users(), this.api.groups(), this.api.sentNotifications()]);
    for (const result of [tasks, users]) {
      if (result.status === 'rejected' && result.reason instanceof HttpErrorResponse && result.reason.status === 401) {
        throw result.reason;
      }
    }
    this.tasksUnavailable = tasks.status === 'rejected';
    this.usersUnavailable = users.status === 'rejected';
    this.tasks = tasks.status === 'fulfilled' ? tasks.value : [];
    this.setUsers(users.status === 'fulfilled' ? users.value : []);
    this.groups = groups.status === 'fulfilled' ? groups.value : [];
    this.sent = sent.status === 'fulfilled' ? sent.value : [];
    this.loaded = true;
  }
  private setUsers(users: User[]) {
    const nameCounts = new Map<string, number>();
    const nameKey = (u: User) => u.name.trim().toLowerCase();
    for (const user of users) {
      const key = nameKey(user);
      nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }
    this.ownerLabels = new Map(users.map(user => [
      user.id, nameCounts.get(nameKey(user)) === 1 ? user.name : user.name + ' (' + user.email + ')'
    ]));
    if (this.ownerId !== null && !this.ownerLabels.has(this.ownerId)) this.ownerId = null;
    this.users = users;
  }

  // ----- sign-in / register -----
  chooseLogin(as: 'user' | 'admin', form: NgForm) {
    if (this.loginAs === as && !this.register) return;
    this.loginAs = as;
    if (this.register) this.switchAuth(form);
    this.error = ''; this.notice = '';
  }
  switchAuth(form: NgForm) {
    this.register = !this.register;
    if (this.register) this.loginAs = 'user';
    this.showPassword = false;
    this.password = '';
    this.confirmation = '';
    this.error = '';
    this.notice = '';
    form.resetForm({name: this.name, email: this.email.trim(), password: '', confirmation: '', group: this.groupName});
  }
  signIn(form: NgForm) {
    if (form.invalid || (this.register && (!this.name.trim() || this.password !== this.confirmation))) return;
    return this.run(async () => {
      if (this.register) {
        await this.api.register(this.name.trim(), this.email.trim(), this.password, this.groupName.trim() || null);
        this.switchAuth(form);
        this.notice = 'Account created. Sign in to open your dashboard.';
      } else {
        await this.api.login(this.email.trim(), this.password, this.loginAs);
        this.showPassword = false;
        this.password = '';
        this.view = 'dashboard';
        await this.refresh();
      }
      this.password = '';
    });
  }

  // ----- tasks -----
  resetForm() { this.editing = undefined; this.draft = emptyTask(); this.editorOpen = false; }
  openEditor() {
    this.editorOpen = true;
    requestAnimationFrame(() => this.titleInput()?.nativeElement.focus());
  }
  dueLabel(t: Task) {
    if (!t.due_date || t.status === 'completed') return '';
    const days = (Date.parse(t.due_date.slice(0, 10) + 'T00:00:00Z') - Date.parse(todayIso() + 'T00:00:00Z')) / 86400000;
    if (days < 0) return Math.abs(days) + (days === -1 ? ' day overdue' : ' days overdue');
    if (days === 0) return 'Due today';
    return days === 1 ? 'Due tomorrow' : '';
  }
  estimateLabel(min?: number | null) {
    if (!min) return '';
    return min >= 60 ? `~${Math.floor(min / 60)} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}` : `~${min} min`;
  }
  edit(t: Task) {
    this.editing = t.id;
    this.draft = {title:t.title, description:t.description ?? '', priority:t.priority,
      due_date:t.due_date?.slice(0,10) || null, status:t.status, estimated_minutes: t.estimated_minutes ?? null};
    this.openEditor();
  }
  // Called by the AI assistant ("Use in a new task" / "Create task with this date").
  useDraft(changes: Partial<Draft>) {
    this.editing = undefined;
    this.draft = {...emptyTask(), ...changes};
    this.notice = 'AI suggestion added to the task form – review it and click "Add task".';
    this.openEditor();
  }
  save() {
    return this.run(async () => {
      await this.api.saveTask({...this.draft, title:this.draft.title.trim(), due_date:this.draft.due_date || null}, this.editing);
      this.resetForm(); await this.refresh();
    });
  }
  toggle(t: Task) {
    return this.run(async () => {
      await this.api.setTaskStatus(t.id, t.status === 'pending' ? 'completed' : 'pending');
      if (this.editing === t.id) this.draft.status = t.status === 'pending' ? 'completed' : 'pending';
      await this.refresh();
    });
  }
  remove(t: Task) {
    if (confirm('Delete “' + t.title + '”?')) this.run(async () => {
      await this.api.deleteTask(t.id); if (this.editing === t.id) this.resetForm(); await this.refresh();
    });
  }

  // ----- admin: users -----
  rename(u: User) {
    const name = this.displayName.trim();
    if (!name || name.length > 100) return;
    return this.run(async () => {
      await this.api.renameUser(u.id, name);
      this.renamingId = undefined;
      await this.refresh();
    });
  }
  changeAccess(user: User) {
    if (user.id === this.api.session?.user.id || typeof user.is_active !== 'boolean') return;
    if (user.is_active && this.deactivatingId !== user.id) return;
    return this.run(async () => {
      await this.api.setUserActive(user.id, !user.is_active);
      this.deactivatingId = undefined;
      await this.refresh();
    });
  }

  // ----- notifications -----
  toggleBell() { this.bellOpen = !this.bellOpen; }
  openNotification(n: AppNotification) {
    if (n.read) return;
    n.read = true;
    this.api.markRead(n.id).catch(() => { n.read = false; });
  }
  markAllRead() {
    return this.run(async () => { await this.api.markAllRead(); this.notifications.forEach(n => n.read = true); });
  }
  sendNotification(form: NgForm) {
    if (!this.compose.title.trim() || !this.compose.message.trim()) return;
    return this.run(async () => {
      await this.api.sendNotification(this.compose.title.trim(), this.compose.message.trim(), this.compose.target);
      const target = this.compose.target ?? 'all users';
      this.compose = {title: '', message: '', target: null};
      form.resetForm({ntitle: '', nmessage: '', ntarget: null});
      await this.refresh();
      this.notice = `Notification sent to ${target}.`;
    });
  }
  deleteNotification(n: SentNotification) {
    if (confirm('Delete the notification “' + n.title + '”?')) this.run(async () => {
      await this.api.deleteNotification(n.id); await this.refresh();
    });
  }
  useNotification(n: {title: string; message: string}) {
    this.compose.title = n.title.slice(0, 120);
    this.compose.message = n.message;
    this.notice = 'AI text added to the notification form – review it and click "Send".';
    document.getElementById('compose-title')?.focus();
  }

  // ----- profile -----
  openProfile() {
    const u = this.api.session!.user;
    this.profile = {name: u.name, group: u.group_name ?? '', current: '', next: '', confirm: ''};
    this.view = 'profile'; this.bellOpen = false; this.error = ''; this.notice = '';
  }
  saveProfile() {
    const name = this.profile.name.trim();
    if (!name) return;
    return this.run(async () => {
      await this.api.updateProfile(this.admin ? {name} : {name, group_name: this.profile.group.trim() || null});
      this.notice = 'Profile updated.';
    });
  }
  changePassword(form: NgForm) {
    const p = this.profile;
    if (p.next.length < 6 || p.next !== p.confirm || !p.current) return;
    return this.run(async () => {
      await this.api.changePassword(p.current, p.next);
      this.profile = {...p, current: '', next: '', confirm: ''};
      form.resetForm({current: '', next: '', confirm: ''});
      this.notice = 'Password changed. Use the new password next time you sign in.';
    });
  }

  reload() { return this.run(() => this.refresh()); }
  logout() {
    this.renamingId = undefined; this.deactivatingId = undefined; this.displayName = '';
    this.ownerLabels.clear(); this.ownerId = null;
    this.api.logout(); this.tasks = []; this.users = []; this.loaded = false;
    this.notifications = []; this.groups = []; this.sent = []; this.bellOpen = false; this.view = 'dashboard';
    this.email = ''; this.password = ''; this.name = ''; this.groupName = ''; this.query = ''; this.filter = 'all';
    this.sort = 'default'; this.notice = ''; this.error = ''; this.resetForm();
  }
}
bootstrapApplication(App, {providers:[provideHttpClient()]}).catch(console.error);
