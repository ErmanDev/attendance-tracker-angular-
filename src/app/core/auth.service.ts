import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
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
  private readonly platformId = inject(PLATFORM_ID);

  private static readonly tokenKey = 'auth_token';

  /** Mirrors session token for tab visibility and guards. */
  private readonly loggedInInternal = signal(false);

  /** Whether the user has a session (browser only). */
  readonly loggedIn = this.loggedInInternal.asReadonly();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loggedInInternal.set(!!sessionStorage.getItem(AuthService.tokenKey));
    }
  }

  /** Same-origin `/api` when using the SSR Express server or `ng serve` + proxy. */
  register(payload: { name: string; email: string; password: string }) {
    return this.http.post<{ user: AuthUser }>('/api/auth/register', payload);
  }

  login(payload: { email: string; password: string }) {
    return this.http.post<LoginResponse>('/api/auth/login', payload).pipe(
      tap((res) => {
        if (isPlatformBrowser(this.platformId)) {
          sessionStorage.setItem(AuthService.tokenKey, res.token);
          this.loggedInInternal.set(true);
        }
      }),
    );
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem(AuthService.tokenKey);
      this.loggedInInternal.set(false);
    }
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return sessionStorage.getItem(AuthService.tokenKey);
  }
}
