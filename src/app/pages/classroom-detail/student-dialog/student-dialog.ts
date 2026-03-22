import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ClassroomService, Student } from '../../../core/classroom.service';
import { messageFromHttpError } from '../../../core/http-error.util';

export interface StudentDialogData {
  classroomId: number;
  /** When set, dialog updates this student instead of creating one. */
  student?: Student;
}

@Component({
  selector: 'app-student-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './student-dialog.html',
  styleUrl: './student-dialog.css',
})
export class StudentDialog {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<StudentDialog, boolean>);
  private readonly data = inject<StudentDialogData>(MAT_DIALOG_DATA);
  private readonly classroomService = inject(ClassroomService);

  readonly isEditMode = this.data.student != null;

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(1)]],
    middleName: [''],
    lastName: ['', [Validators.required, Validators.minLength(1)]],
    gender: ['male' as 'male' | 'female', [Validators.required]],
    email: [''],
    studentId: [''],
  });

  readonly submitError = signal<string | null>(null);
  readonly submitting = signal(false);

  constructor() {
    const s = this.data.student;
    if (s) {
      this.form.patchValue({
        firstName: s.firstName,
        middleName: s.middleName?.trim() ?? '',
        lastName: s.lastName,
        gender: s.gender,
        email: s.email ?? '',
        studentId: s.studentId ?? '',
      });
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.submitting.set(true);
    this.submitError.set(null);
    const middle = raw.middleName.trim();
    const payload = {
      firstName: raw.firstName.trim(),
      ...(middle.length > 0 ? { middleName: middle } : {}),
      lastName: raw.lastName.trim(),
      gender: raw.gender,
      email: raw.email.trim() || undefined,
      studentId: raw.studentId.trim() || undefined,
    };
    const edit = this.data.student;
    const req$ = edit
      ? this.classroomService.updateStudent(this.data.classroomId, edit.id, payload)
      : this.classroomService.createStudent(this.data.classroomId, payload);
    req$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.dialogRef.close(true);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        const fallback = edit ? 'Could not update student.' : 'Could not add student.';
        const msg =
          err instanceof HttpErrorResponse ? messageFromHttpError(err, fallback) : 'Something went wrong.';
        this.submitError.set(msg);
      },
    });
  }
}
