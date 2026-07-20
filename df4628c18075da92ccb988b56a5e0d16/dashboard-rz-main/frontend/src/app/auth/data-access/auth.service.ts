import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthUser, LoginResponse } from '../models/auth.model';

const TOKEN_KEY = 'bi_token';
const USER_KEY = 'bi_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private base = '/api/auth';

  private usuarioSubject = new BehaviorSubject<AuthUser | null>(this.lerUsuarioSalvo());
  usuario$ = this.usuarioSubject.asObservable();

  login(email: string, senha: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/login`, { email, senha }).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this.usuarioSubject.next(res.user);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.usuarioSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get usuario(): AuthUser | null {
    return this.usuarioSubject.value;
  }

  get autenticado(): boolean {
    return !!this.usuario;
  }

  get isAdmin(): boolean {
    return this.usuario?.role === 'admin';
  }

  private lerUsuarioSalvo(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || !this.getToken()) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
}
