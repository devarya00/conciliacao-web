import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LinkRedefinicao, Usuario, UsuarioCriado, UsuarioRole } from '../models/usuario.model';
import { apiBase } from '../../shared/desktop-app';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private http = inject(HttpClient);
  private base = apiBase() + '/api/auth/usuarios';

  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.base);
  }

  criar(email: string, role: UsuarioRole): Observable<UsuarioCriado> {
    return this.http.post<UsuarioCriado>(this.base, { email, role });
  }

  gerarLinkRedefinicao(id: number): Observable<LinkRedefinicao> {
    return this.http.post<LinkRedefinicao>(`${this.base}/${id}/reset-link`, {});
  }

  /** Rota pública (backend) — usuário final define a própria senha via link recebido. */
  redefinirSenha(token: string, novaSenha: string): Observable<void> {
    return this.http.post<void>(`${this.base}/reset-password`, { token, novaSenha });
  }
}
