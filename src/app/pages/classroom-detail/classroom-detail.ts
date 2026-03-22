import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY } from 'rxjs';
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '../../core/auth.service';
import { Classroom, ClassroomService, Student, StudentGender } from '../../core/classroom.service';
import { messageFromHttpError } from '../../core/http-error.util';

@Component({
  selector: 'app-classroom-detail',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
    MatTooltipModule,
    RouterLink,
  ],
  templateUrl: './classroom-detail.html',
  styleUrl: './classroom-detail.css',
})
export class ClassroomDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly classroomService = inject(ClassroomService);
  private readonly auth = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly routeClassroomId = signal<number | null>(null);

  readonly classroom = signal<Classroom | null>(null);
  readonly students = signal<Student[]>([]);
  readonly classroomLoadError = signal<string | null>(null);
  readonly studentsLoadError = signal<string | null>(null);
  readonly notFound = signal(false);
  readonly classroomLoading = signal(false);

  /** Column ids for `mat-table` (order = display order). */
  readonly studentTableColumns = [
    'studentId',
    'lastName',
    'firstName',
    'middleName',
    'email',
    'actions',
  ] as const;

  /** Filters the student list (student ID, names, email; gender text still matches). */
  readonly studentSearch = signal('');

  readonly filteredStudents = computed(() => {
    const list = this.students();
    const q = this.studentSearch().trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter((s) => this.studentMatchesSearch(s, q));
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.route.paramMap
      .pipe(
        map((p) => p.get('id')),
        filter((id): id is string => id !== null),
        map((id) => parseInt(id, 10)),
        filter((id) => Number.isFinite(id)),
        tap((classroomId) => {
          this.routeClassroomId.set(classroomId);
          this.studentSearch.set('');
        }),
        switchMap((classroomId) => {
          this.classroomLoadError.set(null);
          this.studentsLoadError.set(null);
          this.notFound.set(false);
          this.classroom.set(null);
          this.students.set([]);
          if (!this.auth.getToken()) {
            this.classroomLoadError.set('Sign in to view this classroom.');
            return EMPTY;
          }
          this.classroomLoading.set(true);
          return this.classroomService.get(classroomId);
        }),
      )
      .subscribe({
        next: (res) => {
          this.classroomLoading.set(false);
          this.classroom.set(res.classroom);
          this.refreshStudents(res.classroom.id);
        },
        error: (err: unknown) => {
          this.classroomLoading.set(false);
          if (err instanceof HttpErrorResponse && err.status === 404) {
            this.notFound.set(true);
            return;
          }
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.classroomLoadError.set(
              messageFromHttpError(err, 'Session expired or not signed in.'),
            );
            this.auth.logout();
            void this.router.navigate(['/login'], {
              queryParams: { returnUrl: this.router.url },
            });
            return;
          }
          if (err instanceof HttpErrorResponse && err.status === 0) {
            this.classroomLoadError.set(
              'Cannot reach the API. If you use ng serve, run the Express server too (e.g. npm run serve:ssr:attendance-tracker) so /api is available.',
            );
            return;
          }
          const msg = messageFromHttpError(err, 'Could not load classroom.');
          this.classroomLoadError.set(msg);
        },
      });
  }

  retryLoad(): void {
    const id = this.routeClassroomId();
    if (id === null || !this.auth.getToken()) {
      return;
    }
    this.classroomLoadError.set(null);
    this.notFound.set(false);
    this.classroomLoading.set(true);
    this.classroomService.get(id).subscribe({
      next: (res) => {
        this.classroomLoading.set(false);
        this.classroom.set(res.classroom);
        this.refreshStudents(res.classroom.id);
      },
      error: (err: unknown) => {
        this.classroomLoading.set(false);
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.notFound.set(true);
          return;
        }
        this.classroomLoadError.set(messageFromHttpError(err, 'Could not load classroom.'));
      },
    });
  }

  private refreshStudents(classroomId: number): void {
    this.studentsLoadError.set(null);
    this.classroomService.listStudents(classroomId).subscribe({
      next: (res) => this.students.set(res.students),
      error: (err: unknown) =>
        this.studentsLoadError.set(
          err instanceof HttpErrorResponse
            ? messageFromHttpError(err, 'Could not load students.')
            : 'Could not load students.',
        ),
    });
  }

  isSignedIn(): boolean {
    return this.auth.getToken() !== null;
  }

  private activeClassroomId(): number | null {
    return this.classroom()?.id ?? this.routeClassroomId();
  }

  /** Show actions whenever we know which classroom (URL) and user is signed in, even if metadata GET failed. */
  canAddStudent(): boolean {
    if (!this.isSignedIn() || this.notFound()) {
      return false;
    }
    return this.activeClassroomId() !== null;
  }

  openCreateStudent(): void {
    const id = this.activeClassroomId();
    if (id === null || !this.isSignedIn()) {
      return;
    }
    void import('./student-dialog/student-dialog').then(({ StudentDialog }) => {
      const ref = this.dialog.open(StudentDialog, {
        width: 'min(100vw - 32px, 640px)',
        panelClass: 'student-dialog-panel',
        data: { classroomId: id },
        autoFocus: 'first-tabbable',
      });
      ref.afterClosed().subscribe((added) => {
        if (added) {
          this.refreshStudents(id);
        }
      });
    });
  }

  openEditStudent(student: Student): void {
    const id = this.activeClassroomId();
    if (id === null || !this.isSignedIn()) {
      return;
    }
    void import('./student-dialog/student-dialog').then(({ StudentDialog }) => {
      const ref = this.dialog.open(StudentDialog, {
        width: 'min(100vw - 32px, 640px)',
        panelClass: 'student-dialog-panel',
        data: { classroomId: id, student },
        autoFocus: 'first-tabbable',
      });
      ref.afterClosed().subscribe((saved) => {
        if (saved) {
          this.refreshStudents(id);
        }
      });
    });
  }

  confirmDeleteStudent(student: Student): void {
    const classroomId = this.activeClassroomId();
    if (classroomId === null || !this.isSignedIn()) {
      return;
    }
    const label = `${student.firstName} ${student.lastName}`.trim() || 'this student';
    if (
      !globalThis.confirm(
        `Delete ${label}? Related attendance rows for this student will be removed.`,
      )
    ) {
      return;
    }
    this.classroomService.deleteStudent(classroomId, student.id).subscribe({
      next: () => this.refreshStudents(classroomId),
      error: (err: unknown) => {
        const msg =
          err instanceof HttpErrorResponse
            ? messageFromHttpError(err, 'Could not delete student.')
            : 'Could not delete student.';
        this.studentsLoadError.set(msg);
      },
    });
  }

  back(): void {
    void this.router.navigateByUrl('/home');
  }

  goCreateAttendance(): void {
    const id = this.classroom()?.id ?? this.routeClassroomId();
    if (id === null) {
      return;
    }
    void this.router.navigate(['/classroom', id, 'attendance']);
  }

  genderLabel(gender: StudentGender): string {
    return gender === 'female' ? 'Female' : 'Male';
  }

  onStudentSearchInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.studentSearch.set(el.value);
  }

  private studentMatchesSearch(s: Student, q: string): boolean {
    const haystack = [
      s.studentId ?? '',
      s.firstName,
      s.middleName?.trim() ?? '',
      s.lastName,
      s.email ?? '',
      this.genderLabel(s.gender),
    ]
      .join(' ')
      .toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    return tokens.every((t) => haystack.includes(t));
  }
}
