import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RelatorioGerado } from '../models/relatorio.model';
import { apiBase } from '../../shared/desktop-app';

@Injectable({ providedIn: 'root' })
export class RelatoriosService {
  private http = inject(HttpClient);
  private base = apiBase() + '/api/relatorios';

  listar(): Observable<RelatorioGerado[]> {
    return this.http.get<RelatorioGerado[]>(this.base);
  }

  gerar(nomeEmpresa: string, balancete: File, resumo: File): Observable<RelatorioGerado> {
    const formData = new FormData();
    formData.append('nomeEmpresa', nomeEmpresa);
    formData.append('balancete', balancete);
    formData.append('resumo', resumo);
    return this.http.post<RelatorioGerado>(this.base, formData);
  }

  baixar(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/download`, { responseType: 'blob' });
  }

  remover(id: number): Observable<{ removido: boolean }> {
    return this.http.delete<{ removido: boolean }>(`${this.base}/${id}`);
  }
}
