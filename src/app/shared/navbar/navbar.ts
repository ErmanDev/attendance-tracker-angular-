import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatTabLink, MatTabNav, MatTabNavPanel } from '@angular/material/tabs';

export interface NavTab {
  label: string;
  path: string;
  /** If set, tab is active when the URL path (no query) is one of these. */
  activePaths?: string[];
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatTabNav, MatTabNavPanel, MatTabLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly router = inject(Router);

  readonly navTabs: NavTab[] = [
    { label: 'Home', path: '/home', activePaths: ['/', '/home'] },
    { label: 'About', path: '/about' },
    { label: 'Login', path: '/login' },
    { label: 'Register', path: '/register' },
  ];

  isTabActive(tab: NavTab): boolean {
    const path = this.router.url.split('?')[0];
    if (tab.activePaths?.length) {
      return tab.activePaths.includes(path);
    }
    return path === tab.path || path.startsWith(`${tab.path}/`);
  }
}
