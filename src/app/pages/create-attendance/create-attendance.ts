import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { downloadAttendancePdf } from '../../core/attendance-pdf';
import { AuthService } from '../../core/auth.service';
import {
  AttendanceSession,
  Classroom,
  ClassroomService,
  Student,
} from '../../core/classroom.service';
import { messageFromHttpError } from '../../core/http-error.util';

@Component({
  selector: 'app-create-attendance',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
    RouterLink,
  ],
  templateUrl: './create-attendance.html',
  styleUrl: './create-attendance.css',
})
export class CreateAttendance implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly classroomService = inject(ClassroomService);
  private readonly auth = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  private paramSub: Subscription | null = null;

  readonly classroomId = signal<number | null>(null);
  readonly classroom = signal<Classroom | null>(null);
  readonly students = signal<Student[]>([]);
  readonly sessions = signal<AttendanceSession[]>([]);
  readonly pageError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);
  readonly sessionsError = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly sessionLabel = signal('');
  /** student row id → present */
  readonly presentByStudentId = signal<Map<number, boolean>>(new Map());

  readonly tableColumns = [
    'schoolStudentId',
    'present',
    'firstName',
    'middleName',
    'lastName',
    'gender',
    'email',
  ] as const;

  readonly historyColumns = ['createdAt', 'label', 'actions'] as const;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.paramSub = this.route.paramMap.subscribe((p) => {
      const raw = p.get('id');
      const id = raw !== null ? parseInt(raw, 10) : NaN;
      if (!Number.isFinite(id)) {
        void this.router.navigateByUrl('/home');
        return;
      }
      this.classroomId.set(id);
      this.loadPage(id);
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }

  private loadPage(classroomId: number): void {
    if (!this.auth.getToken()) {
      void this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    this.pageError.set(null);
    this.submitError.set(null);
    this.sessionsError.set(null);
    this.classroom.set(null);
    this.students.set([]);
    this.sessions.set([]);
    this.presentByStudentId.set(new Map());

    this.classroomService.get(classroomId).subscribe({
      next: (res) => {
        this.classroom.set(res.classroom);
      },
      error: (err: unknown) => {
        this.pageError.set(
          err instanceof HttpErrorResponse
            ? messageFromHttpError(err, 'Could not load classroom.')
            : 'Could not load classroom.',
        );
      },
    });

    this.classroomService.listStudents(classroomId).subscribe({
      next: (res) => {
        this.students.set(res.students);
        const m = new Map<number, boolean>();
        for (const s of res.students) {
          m.set(s.id, false);
        }
        this.presentByStudentId.set(m);
      },
      error: (err: unknown) => {
        this.pageError.set(
          err instanceof HttpErrorResponse
            ? messageFromHttpError(err, 'Could not load students.')
            : 'Could not load students.',
        );
      },
    });

    this.refreshSessions(classroomId);
  }

  private refreshSessions(classroomId: number): void {
    this.sessionsError.set(null);
    this.classroomService.listAttendanceSessions(classroomId).subscribe({
      next: (res) => this.sessions.set(res.sessions),
      error: (err: unknown) =>
        this.sessionsError.set(
          err instanceof HttpErrorResponse
            ? messageFromHttpError(err, 'Could not load attendance history.')
            : 'Could not load attendance history.',
        ),
    });
  }

  isPresent(studentRowId: number): boolean {
    return this.presentByStudentId().get(studentRowId) ?? false;
  }

  setPresent(studentRowId: number, value: boolean): void {
    const m = new Map(this.presentByStudentId());
    m.set(studentRowId, value);
    this.presentByStudentId.set(m);
  }

  selectAllPresent(): void {
    const m = new Map<number, boolean>();
    for (const s of this.students()) {
      m.set(s.id, true);
    }
    this.presentByStudentId.set(m);
  }

  clearAllPresent(): void {
    const m = new Map<number, boolean>();
    for (const s of this.students()) {
      m.set(s.id, false);
    }
    this.presentByStudentId.set(m);
  }

  onSessionLabelInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.sessionLabel.set(v);
  }

  studentDisplayName(s: Student): string {
    const mid = s.middleName?.trim();
    return [s.firstName, mid, s.lastName].filter((p) => !!p && p.length > 0).join(' ');
  }

  genderLabel(g: Student['gender']): string {
    return g === 'female' ? 'Female' : 'Male';
  }

  submitAttendance(): void {
    const cid = this.classroomId();
    const c = this.classroom();
    if (cid === null || c === null || this.students().length === 0 || this.submitting()) {
      return;
    }
    const records = this.students().map((s) => ({
      studentId: s.id,
      present: this.presentByStudentId().get(s.id) ?? false,
    }));
    const trimmed = this.sessionLabel().trim();
    const label = trimmed.length > 0 ? trimmed : this.defaultAttendanceLabel(c);
    this.submitting.set(true);
    this.submitError.set(null);
    this.classroomService
      .submitAttendance(cid, {
        label,
        records,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.sessionLabel.set('');
          this.clearAllPresent();
          this.refreshSessions(cid);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.submitError.set(
            err instanceof HttpErrorResponse
              ? messageFromHttpError(err, 'Could not save attendance.')
              : 'Could not save attendance.',
          );
        },
      });
  }

  downloadSessionPdf(sessionId: number): void {
    const cid = this.classroomId();
    const c = this.classroom();
    if (cid === null || !c) {
      return;
    }
    this.classroomService.getAttendanceSession(cid, sessionId).subscribe({
      next: (res) => {
        const records = res.records.map((r) => ({
          schoolStudentId: r.studentIdLabel,
          fullName: [r.firstName, r.middleName?.trim(), r.lastName].filter(Boolean).join(' '),
          present: r.present,
          email: r.email,
        }));
        void downloadAttendancePdf(c, res.session, records).catch(() => {
          this.sessionsError.set('Could not generate PDF.');
        });
      },
      error: (err: unknown) => {
        this.sessionsError.set(
          err instanceof HttpErrorResponse
            ? messageFromHttpError(err, 'Could not load attendance for PDF.')
            : 'Could not load attendance for PDF.',
        );
      },
    });
  }

  /**
   * Default label when the field is left blank: subject · course · year · MMDDYYYY (local date).
   */
  private defaultAttendanceLabel(c: Classroom): string {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = String(now.getFullYear());
    const mmddyyyy = `${mm}${dd}${yyyy}`;
    return `${c.subjectName} · ${c.course} · ${c.year} · ${mmddyyyy}`;
  }

  formatSessionDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  deleteSession(sessionId: number): void {
    const cid = this.classroomId();
    if (cid === null) {
      return;
    }
    if (
      typeof globalThis.confirm === 'function' &&
      !globalThis.confirm('Delete this attendance session? This cannot be undone.')
    ) {
      return;
    }
    this.classroomService.deleteAttendanceSession(cid, sessionId).subscribe({
      next: () => this.refreshSessions(cid),
      error: (err: unknown) => {
        this.sessionsError.set(
          err instanceof HttpErrorResponse
            ? messageFromHttpError(err, 'Could not delete attendance.')
            : 'Could not delete attendance.',
        );
      },
    });
  }
}
