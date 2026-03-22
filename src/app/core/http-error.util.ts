import { HttpErrorResponse } from '@angular/common/http';

export function messageFromHttpError(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error;
    if (body && typeof body === 'object' && 'message' in body) {
      const msg = (body as { message: unknown }).message;
      if (typeof msg === 'string' && msg.length > 0) {
        return msg;
      }
    }
    if (err.message) {
      return err.message;
    }
  }
  return fallback;
}
