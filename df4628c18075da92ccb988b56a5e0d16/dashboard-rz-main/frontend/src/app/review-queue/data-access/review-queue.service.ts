import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Colaborador,
  ContagemPendentes,
  ResponsavelAtivo,
  ResponsavelNaoMapeado,
  ResultadoAprovacao,
  ResultadoMesclagem,
  ResultadoVinculo,
  ReviewQueueGrupo,
  SugestaoColaborador,
} from '../models/review-queue.model';
import { apiBase } from '../../shared/desktop-app';

@Injectable({ providedIn: 'root' })
export class ReviewQueueService {
  private http = inject(HttpClient);
  private base = apiBase() + '/api/ingestion/review';
  private baseResponsaveis = apiBase() + '/api/dashboard/responsaveis';
  private baseColaboradores = apiBase() + '/api/dashboard/colaboradores';

  listar(departamento?: string, sourceFile?: string): Observable<ReviewQueueGrupo[]> {
    const params: Record<string, string> = {};
    if (departamento) params['departamento'] = departamento;
    if (sourceFile) params['sourceFile'] = sourceFile;
    return this.http.get<ReviewQueueGrupo[]>(this.base, { params });
  }

  contar(): Observable<ContagemPendentes> {
    return this.http.get<ContagemPendentes>(`${this.base}/count`);
  }

  sugestoes(id: number): Observable<SugestaoColaborador[]> {
    return this.http.get<SugestaoColaborador[]>(`${this.base}/${id}/suggestions`);
  }

  aprovar(id: number, employeeId: number): Observable<ResultadoAprovacao> {
    return this.http.post<ResultadoAprovacao>(`${this.base}/${id}/approve`, { employeeId });
  }

  rejeitar(id: number): Observable<{ linhasRejeitadas: number }> {
    return this.http.post<{ linhasRejeitadas: number }>(`${this.base}/${id}/reject`, {});
  }

  novoFuncionario(id: number, canonicalName: string, departamento: string): Observable<ResultadoAprovacao> {
    return this.http.post<ResultadoAprovacao>(`${this.base}/${id}/new-employee`, { canonicalName, departamento });
  }

  listarResponsaveisNaoMapeados(): Observable<ResponsavelNaoMapeado[]> {
    return this.http.get<ResponsavelNaoMapeado[]>(`${this.baseResponsaveis}/nao-mapeados`);
  }

  listarResponsaveisAtivos(): Observable<ResponsavelAtivo[]> {
    return this.http.get<ResponsavelAtivo[]>(`${this.baseResponsaveis}/ativos`);
  }

  vincularResponsavel(rawResponsavelS3d: string, nomeCanonico: string, departamento?: string): Observable<ResultadoVinculo> {
    return this.http.post<ResultadoVinculo>(`${this.baseResponsaveis}/vincular`, { rawResponsavelS3d, nomeCanonico, departamento });
  }

  descartarResponsavel(rawResponsavelS3d: string): Observable<{ linhasReprocessadas: number }> {
    return this.http.post<{ linhasReprocessadas: number }>(`${this.baseResponsaveis}/descartar`, { rawResponsavelS3d });
  }

  listarColaboradores(): Observable<Colaborador[]> {
    return this.http.get<Colaborador[]>(this.baseColaboradores);
  }

  atualizarStatusColaborador(id: number, status: 'ativo' | 'inativo'): Observable<Colaborador> {
    return this.http.post<Colaborador>(`${this.baseColaboradores}/${id}/status`, { status });
  }

  mesclarColaborador(duplicadoId: number, canonicoId: number): Observable<ResultadoMesclagem> {
    return this.http.post<ResultadoMesclagem>(`${this.baseColaboradores}/${duplicadoId}/mesclar`, { canonicoId });
  }
}
