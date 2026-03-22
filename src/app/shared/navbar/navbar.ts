import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth.service';
import { LiveClock } from '../live-clock/live-clock';

export interface NavTab {
  label: string;
  path: string;
  /** If set, tab is active when the URL path (no query) is one of these. */
  activePaths?: string[];
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatButtonModule, LiveClock],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  /** Shown before sign-in: only auth entry points. */
  readonly guestTabs: NavTab[] = [];

  /** Shown after sign-in. */
  readonly memberTabs: NavTab[] = [
    { label: 'Home', path: '/home', activePaths: ['/home'] },
    { label: 'About', path: '/about', activePaths: ['/about'] },
  ];

  isTabActive(tab: NavTab): boolean {
    const path = this.router.url.split('?')[0];
    if (tab.path === '/home' && path.startsWith('/classroom/')) {
      return true;
    }
    if (tab.activePaths?.length) {
      return tab.activePaths.includes(path);
    }
    return path === tab.path || path.startsWith(`${tab.path}/`);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
