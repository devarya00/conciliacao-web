import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { apiBase } from '../../shared/desktop-app';

const LOGIN_URL = `${apiBase()}/api/auth/login`;

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private auth = inject(AuthService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.auth.getToken();
    const request = token && req.url.includes('/api/')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(request).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401 && req.url !== LOGIN_URL) {
          this.auth.logout();
        }
        return throwError(() => err);
      }),
    );
  }
}
