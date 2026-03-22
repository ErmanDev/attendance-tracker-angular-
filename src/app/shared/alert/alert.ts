import { Component, input } from '@angular/core';

@Component({
  selector: 'app-alert',
  standalone: true,
  templateUrl: './alert.html',
  styleUrl: './alert.css',
})
export class Alert {
  readonly variant = input<'success' | 'error' | 'info'>('info');
  readonly message = input.required<string>();
}
