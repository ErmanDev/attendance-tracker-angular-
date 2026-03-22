import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { timer } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { messageFromHttpError } from '../../core/http-error.util';
import { Alert } from '../../shared/alert/alert';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Alert],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly submitError = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly loginSuccess = signal(false);

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.submitError.set(null);
    this.loginSuccess.set(false);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.loginSuccess.set(true);
        timer(2200)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => {
            void this.router.navigateByUrl('/home');
          });
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        const msg =
          err instanceof HttpErrorResponse
            ? messageFromHttpError(err, 'Sign in failed.')
            : 'Something went wrong.';
        this.submitError.set(msg);
      },
    });
  }
}
