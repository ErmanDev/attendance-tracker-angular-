import { Component, signal } from '@angular/core';
import { Navbar } from './shared/navbar/navbar';

@Component({
  selector: 'app-root',
  imports: [Navbar],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('attendance-tracker');
}
