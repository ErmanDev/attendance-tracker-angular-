import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Classroom, ClassroomService } from '../../core/classroom.service';
import { messageFromHttpError } from '../../core/http-error.util';

@Component({
  selector: 'app-home',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatTooltipModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly classroomService = inject(ClassroomService);
  private readonly auth = inject(AuthService);

  readonly classrooms = signal<Classroom[]>([]);
  readonly loadError = signal<string | null>(null);

  ngOnInit(): void {
    this.refreshClassrooms();
  }

  isSignedIn(): boolean {
    return this.auth.getToken() !== null;
  }

  refreshClassrooms(): void {
    if (!this.isSignedIn()) {
      this.classrooms.set([]);
      return;
    }
    this.loadError.set(null);
    this.classroomService.list().subscribe({
      next: (res) => this.classrooms.set(res.classrooms),
      error: () => this.loadError.set('Could not load classrooms. Try signing in again.'),
    });
  }

  openCreateClassroom(): void {
    if (!this.isSignedIn()) {
      return;
    }
    void import('./classroom-dialog/classroom-dialog').then(({ ClassroomDialog }) => {
      const ref = this.dialog.open(ClassroomDialog, {
        width: 'min(100vw - 32px, 480px)',
        autoFocus: 'first-tabbable',
      });
      ref.afterClosed().subscribe((created) => {
        if (created) {
          this.refreshClassrooms();
        }
      });
    });
  }

  confirmDeleteClassroom(c: Classroom): void {
    if (!this.isSignedIn()) {
      return;
    }
    const label = c.subjectName.trim() || 'this classroom';
    if (
      !globalThis.confirm(
        `Delete “${label}”? All students and attendance for this classroom will be permanently removed.`,
      )
    ) {
      return;
    }
    this.loadError.set(null);
    this.classroomService.delete(c.id).subscribe({
      next: () => this.refreshClassrooms(),
      error: (err: unknown) => {
        const msg =
          err instanceof HttpErrorResponse
            ? messageFromHttpError(err, 'Could not delete classroom.')
            : 'Could not delete classroom.';
        this.loadError.set(msg);
      },
    });
  }
}
