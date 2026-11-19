import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface User { id: number; name: string; email: string; role: 'user' | 'admin'; is_active: boolean }
export interface Draft {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  due_date: string | null;
}
export interface Task extends Draft { id: number; user_id: number }
interface Session { token: string; user: User }

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  session: Session | null = null;

  register(name: string, email: string, password: string) {
    return firstValueFrom(this.http.post('/api/auth/register', {name, email, password}));
  }

  async login(email: string, password: string) {
    const result = await firstValueFrom(this.http.post<Session>('/api/auth/login', {email, password}));
    if (!result.token || !['user', 'admin'].includes(result.user?.role)) {
      throw new Error('The login response is missing a token or a recognised role.');
    }
    this.session = result;
  }

  private request<T>(method: string, path: string, body?: unknown) {
    return firstValueFrom(this.http.request<T>(method, '/api' + path, {
      body, headers: {Authorization: 'Bearer ' + this.session?.token}
    }));
  }

  tasks(admin = false) { return this.request<Task[]>('GET', admin ? '/admin/tasks' : '/tasks'); }
  users() { return this.request<User[]>('GET', '/admin/users'); }
  saveTask(draft: Draft, id?: number) {
    return id === undefined ? this.request('POST', '/tasks', draft)
      : this.request('PUT', '/tasks/' + id, draft);
  }
  deleteTask(id: number) { return this.request('DELETE', '/tasks/' + id); }
  renameUser(id: number, name: string) { return this.request('PATCH', '/admin/users/' + id, {name}); }
  setUserActive(id: number, active: boolean) {
    return this.request('PATCH', '/admin/users/' + id, {is_active: active});
  }
}
