import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-live-clock',
  standalone: true,
  templateUrl: './live-clock.html',
  styleUrl: './live-clock.css',
})
export class LiveClock implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Local date line (updates every second so “today” stays correct past midnight). */
  readonly dateLine = signal('');

  /** Local time with seconds. */
  readonly timeLine = signal('');

  /** ISO string for semantic `datetime` on the element. */
  readonly iso = signal('');

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    const now = new Date();
    this.dateLine.set(
      now.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    );
    this.timeLine.set(
      now.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
    this.iso.set(now.toISOString());
  }
}
