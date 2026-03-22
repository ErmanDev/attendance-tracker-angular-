import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private static readonly tokenKey = 'auth_token';

  /** Same-origin `/api` when using the SSR Express server or `ng serve` + proxy. */
  register(payload: { name: string; email: string; password: string }) {
    return this.http.post<{ user: AuthUser }>('/api/auth/register', payload);
  }

  login(payload: { email: string; password: string }) {
    return this.http.post<LoginResponse>('/api/auth/login', payload).pipe(
      tap((res) => sessionStorage.setItem(AuthService.tokenKey, res.token)),
    );
  }

  logout(): void {
    sessionStorage.removeItem(AuthService.tokenKey);
  }

  getToken(): string | null {
    return sessionStorage.getItem(AuthService.tokenKey);
  }
}
