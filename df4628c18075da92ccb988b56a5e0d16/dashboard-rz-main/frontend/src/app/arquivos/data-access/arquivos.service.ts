import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Arquivo, FiltroArquivos, Origem } from '../models/arquivo.model';

@Injectable({ providedIn: 'root' })
export class ArquivosService {
  private http = inject(HttpClient);
  private base = '/api/dashboard/arquivos';

  listar(filtro: FiltroArquivos = {}): Observable<Arquivo[]> {
    const params: Record<string, string> = {};
    if (filtro.dataInicial) params['dataInicial'] = filtro.dataInicial;
    if (filtro.dataFinal) params['dataFinal'] = filtro.dataFinal;
    return this.http.get<Arquivo[]>(this.base, { params });
  }

  upload(arquivo: File, origem: Origem): Observable<Arquivo> {
    const formData = new FormData();
    formData.append('arquivo', arquivo);
    formData.append('origem', origem);
    return this.http.post<Arquivo>(this.base, formData);
  }

  remover(id: number): Observable<{ removido: boolean }> {
    return this.http.delete<{ removido: boolean }>(`${this.base}/${id}`);
  }
}
