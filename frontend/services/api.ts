import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface SessionUser { id: number; name: string; email: string; role: 'user' | 'admin'; group_name?: string | null }
export interface User extends SessionUser { is_active: boolean }
export interface Draft {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  due_date: string | null;
  estimated_minutes?: number | null;
}
export interface Task extends Draft { id: number; user_id: number }
export interface AppNotification { id: number; title: string; message: string; target_group: string | null; created_at: string; read: boolean }
export interface SentNotification extends Omit<AppNotification, 'read'> { read_count: number; audience: number }
export interface Group { group_name: string; members: number }
export type Provider = 'gemini' | 'grok';
export interface AiInfo {
  mock: boolean;
  providers: Record<Provider, { label: string; model: string; configured: boolean }>;
  features: { id: string; label: string }[];
}
export interface AiResponse { feature: string; provider: Provider; model: string; elapsedMs: number; mock: boolean; result: any }
export interface AiStat { feature: string; provider: Provider; runs: number; ok_runs: number; avg_ms: number | null; min_ms: number | null; max_ms: number | null }
interface Session { token: string; user: SessionUser }
const sessionKey = 'grp10.todo.session';

function validSession(value: Session | null): value is Session {
  return typeof value?.token === 'string' && value.token.length > 0
    && Number.isInteger(value.user?.id) && typeof value.user.name === 'string'
    && typeof value.user.email === 'string' && ['user', 'admin'].includes(value.user.role);
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  session: Session | null = this.restoreSession();

  private restoreSession(): Session | null {
    try {
      const saved = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null');
      if (validSession(saved)) return saved;
      sessionStorage.removeItem(sessionKey);
    } catch { /* Missing or inaccessible storage starts a signed-out session. */ }
    return null;
  }

  private saveSession() {
    try { if (this.session) sessionStorage.setItem(sessionKey, JSON.stringify(this.session)); }
    catch { /* The current page still works when storage is unavailable. */ }
  }

  logout() {
    this.session = null;
    try { sessionStorage.removeItem(sessionKey); }
    catch { /* Storage can be disabled by the browser. */ }
  }

  register(name: string, email: string, password: string, group_name: string | null) {
    return firstValueFrom(this.http.post('/api/auth/register', {name, email, password, group_name}));
  }

  async login(email: string, password: string, as: 'user' | 'admin') {
    const result = await firstValueFrom(this.http.post<Session>('/api/auth/login', {email, password, as}));
    if (!validSession(result)) {
      throw new Error('The login response is missing a token or a recognised role.');
    }
    const {id, name, role, group_name} = result.user;
    this.session = {token: result.token, user: {id, name, email: result.user.email, role, group_name: group_name ?? null}};
    this.saveSession();
  }

  private request<T>(method: string, path: string, body?: unknown) {
    return firstValueFrom(this.http.request<T>(method, '/api' + path, {
      body, headers: {Authorization: 'Bearer ' + this.session?.token}
    }));
  }

  // ----- tasks -----
  myTasks() { return this.request<Task[]>('GET', '/tasks'); }
  allTasks() { return this.request<Task[]>('GET', '/admin/tasks'); }
  users() { return this.request<User[]>('GET', '/admin/users'); }
  saveTask(draft: Draft, id?: number) {
    return id === undefined ? this.request('POST', '/tasks', draft)
      : this.request('PUT', '/tasks/' + id, draft);
  }
  patchTask(id: number, changes: Partial<Draft>) { return this.request<Task>('PATCH', '/tasks/' + id, changes); }
  deleteTask(id: number) { return this.request('DELETE', '/tasks/' + id); }
  setTaskStatus(id: number, status: Task['status']) { return this.request('PATCH', '/tasks/' + id, {status}); }
  renameUser(id: number, name: string) { return this.request('PATCH', '/admin/users/' + id, {name}); }
  setUserActive(id: number, active: boolean) {
    return this.request('PATCH', '/admin/users/' + id, {is_active: active});
  }

  // ----- profile -----
  async updateProfile(changes: { name?: string; group_name?: string | null }) {
    const user = await this.request<SessionUser>('PATCH', '/auth/me', changes);
    if (this.session) { this.session.user = {...this.session.user, name: user.name, group_name: user.group_name}; this.saveSession(); }
    return user;
  }
  changePassword(current_password: string, new_password: string) {
    return this.request<{message: string}>('PATCH', '/auth/password', {current_password, new_password});
  }

  // ----- notifications -----
  notifications() { return this.request<AppNotification[]>('GET', '/notifications'); }
  markRead(id: number) { return this.request('PATCH', `/notifications/${id}/read`); }
  markAllRead() { return this.request('POST', '/notifications/read-all'); }
  groups() { return this.request<Group[]>('GET', '/admin/groups'); }
  sentNotifications() { return this.request<SentNotification[]>('GET', '/admin/notifications'); }
  sendNotification(title: string, message: string, target_group: string | null) {
    return this.request('POST', '/admin/notifications', {title, message, target_group});
  }
  deleteNotification(id: number) { return this.request('DELETE', '/admin/notifications/' + id); }

  // ----- AI (Gemini / Grok) -----
  aiInfo() { return this.request<AiInfo>('GET', '/ai/features'); }
  aiRun(feature: string, provider: Provider, input: Record<string, unknown> = {}) {
    return this.request<AiResponse>('POST', '/ai/' + feature, {...input, provider});
  }
  aiStats() { return this.request<AiStat[]>('GET', '/ai/stats'); }
}
