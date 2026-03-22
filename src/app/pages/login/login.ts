import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { timer } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { messageFromHttpError } from '../../core/http-error.util';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Alert } from '../../shared/alert/alert';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, Alert],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly submitError = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly loginSuccess = signal(false);

  ngOnInit(): void {
    if (this.auth.getToken()) {
      void this.router.navigateByUrl('/home');
    }
  }

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
            const raw = this.route.snapshot.queryParamMap.get('returnUrl');
            const target =
              raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('://')
                ? raw
                : '/home';
            void this.router.navigateByUrl(target);
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
