import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Filtro, toParams } from '../../produtividade/models/filtro.model';
import { FiltrosOptions } from '../../produtividade/models/dashboard.model';
import { StatusTempo, WorkmonitorColaborador, WorkmonitorTotais } from '../models/workmonitor.model';
import { apiBase } from '../../shared/desktop-app';

@Injectable({ providedIn: 'root' })
export class WorkmonitorService {
  private http = inject(HttpClient);
  private base = apiBase() + '/api/dashboard';

  filtros(): Observable<FiltrosOptions> {
    return this.http.get<FiltrosOptions>(`${this.base}/filtros`);
  }

  statusTempo(f: Filtro): Observable<StatusTempo[]> {
    return this.http.get<StatusTempo[]>(`${this.base}/status-tempo`, { params: toParams(f) });
  }

  totais(f: Filtro): Observable<WorkmonitorTotais> {
    return this.http.get<WorkmonitorTotais>(`${this.base}/workmonitor-totais`, { params: toParams(f) });
  }

  colaboradores(f: Filtro): Observable<WorkmonitorColaborador[]> {
    return this.http.get<WorkmonitorColaborador[]>(`${this.base}/workmonitor-colaboradores`, { params: toParams(f) });
  }
}
