import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ClassroomService } from '../../../core/classroom.service';
import { messageFromHttpError } from '../../../core/http-error.util';

@Component({
  selector: 'app-classroom-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './classroom-dialog.html',
  styleUrl: './classroom-dialog.css',
})
export class ClassroomDialog {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ClassroomDialog, boolean>);
  private readonly classroomService = inject(ClassroomService);

  readonly form = this.fb.nonNullable.group({
    subjectName: ['', [Validators.required]],
    course: ['', [Validators.required]],
    year: ['', [Validators.required]],
    room: ['', [Validators.required]],
  });

  readonly submitError = signal<string | null>(null);
  readonly submitting = signal(false);

  cancel(): void {
    this.dialogRef.close(false);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.submitError.set(null);
    this.classroomService.create(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.dialogRef.close(true);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        const msg =
          err instanceof HttpErrorResponse
            ? messageFromHttpError(err, 'Could not create classroom.')
            : 'Something went wrong.';
        this.submitError.set(msg);
      },
    });
  }
}
