import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, Draft, Task, User } from '../services/api';

function emptyTask(): Draft {
  return {title: '', description: '', priority: 'medium', due_date: null, status: 'pending'};
}

@Component({
  selector: 'app-root', standalone: true, imports: [FormsModule, DatePipe], templateUrl: './app.html'
})
class App {
  api = inject(Api);
  private titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  register = false;
  email = ''; password = ''; name = '';
  busy = false; notice = ''; error = ''; loaded = false;
  tasks: Task[] = []; users: User[] = [];
  filter = 'all'; query = '';
  ownerId: number | null = null;
  ownerLabels = new Map<number, string>();
  sort = 'default';
  draft = emptyTask(); editing?: number;
  get admin() { return this.api.session?.user.role === 'admin'; }
  ngOnInit() {
    if (this.api.session) void this.reload();
  }
  get completed() { return this.tasks.filter(t => t.status === 'completed').length; }
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
  async run(action: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true; this.error = ''; this.notice = '';
    try { await action(); }
    catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401 && this.api.session) this.logout();
      this.error = err instanceof HttpErrorResponse
        ? (err.error?.message || 'Request failed. Check your details and the API connection.')
        : err instanceof Error ? err.message : 'Request failed.';
    } finally { this.busy = false; }
  }
  async refresh() {
    this.loaded = false;
    const [tasks, users] = await Promise.all([this.api.tasks(this.admin), this.admin ? this.api.users() : []]);
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
    this.tasks = tasks; this.users = users; this.loaded = true;
  }
  signIn() {
    return this.run(async () => {
      if (this.register) {
        await this.api.register(this.name.trim(), this.email.trim(), this.password);
        this.register = false; this.notice = 'Account created. Sign in to continue.';
      } else {
        await this.api.login(this.email.trim(), this.password);
        this.password = '';
        await this.refresh();
      }
      this.password = '';
    });
  }
  resetForm() { this.editing = undefined; this.draft = emptyTask(); }
  edit(t: Task) {
    this.editing = t.id;
    this.draft = {title:t.title, description:t.description, priority:t.priority,
      due_date:t.due_date?.slice(0,10) || null, status:t.status};
    this.titleInput()?.nativeElement.focus();
  }
  save() {
    return this.run(async () => {
      await this.api.saveTask({...this.draft, title:this.draft.title.trim(), due_date:this.draft.due_date || null}, this.editing);
      this.resetForm(); await this.refresh();
    });
  }
  toggle(t: Task) {
    const {title, description, priority, due_date} = t;
    return this.run(async () => {
      await this.api.saveTask({title, description, priority, due_date,
        status:t.status === 'pending' ? 'completed' : 'pending'}, t.id);
      await this.refresh();
    });
  }
  remove(t: Task) {
    if (confirm('Delete “' + t.title + '”?')) this.run(async () => {
      await this.api.deleteTask(t.id); if (this.editing === t.id) this.resetForm(); await this.refresh();
    });
  }
  rename(u: User) {
    const name = prompt('Update display name', u.name)?.trim();
    if (name && name.length > 100) {
      this.error = 'Use 100 characters or fewer for the display name.';
      return;
    }
    if (name && name !== u.name) this.run(async () => { await this.api.renameUser(u.id, name); await this.refresh(); });
  }
  changeAccess(user: User) {
    if (user.id === this.api.session?.user.id || typeof user.is_active !== 'boolean') return;
    if (user.is_active && !confirm('Deactivate ' + user.name + ' and remove their access?')) return;
    return this.run(async () => {
      await this.api.setUserActive(user.id, !user.is_active);
      await this.refresh();
    });
  }
  reload() { return this.run(() => this.refresh()); }
  logout() {
    this.ownerLabels.clear(); this.ownerId = null;
    this.api.logout(); this.tasks = []; this.users = []; this.loaded = false;
    this.email = ''; this.password = ''; this.name = ''; this.query = ''; this.filter = 'all';
    this.sort = 'default'; this.notice = ''; this.error = ''; this.resetForm();
  }
}
bootstrapApplication(App, {providers:[provideHttpClient()]}).catch(console.error);
