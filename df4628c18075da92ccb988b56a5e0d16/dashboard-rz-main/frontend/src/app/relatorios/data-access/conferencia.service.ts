import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConferenciaResponse, ConferenciaStatus } from '../models/conferencia.model';
import { RelatorioGerado } from '../models/relatorio.model';
import { apiBase } from '../../shared/desktop-app';

@Injectable({ providedIn: 'root' })
export class ConferenciaService {
  private http = inject(HttpClient);
  private base = apiBase() + '/api/relatorios';

  buscar(relatorioId: number): Observable<ConferenciaResponse> {
    return this.http.get<ConferenciaResponse>(`${this.base}/${relatorioId}/conferencia`);
  }

  atualizarItem(
    relatorioId: number,
    passoId: number,
    status: ConferenciaStatus,
    observacao?: string,
  ): Observable<ConferenciaResponse> {
    return this.http.patch<ConferenciaResponse>(`${this.base}/${relatorioId}/conferencia/${passoId}`, {
      status,
      observacao,
    });
  }

  gerarFinal(relatorioId: number): Observable<RelatorioGerado> {
    return this.http.post<RelatorioGerado>(`${this.base}/${relatorioId}/gerar-final`, {});
  }

  baixarConferenciaPdf(relatorioId: number): Observable<Blob> {
    return this.http.get(`${this.base}/${relatorioId}/conferencia/pdf`, { responseType: 'blob' });
  }
}
