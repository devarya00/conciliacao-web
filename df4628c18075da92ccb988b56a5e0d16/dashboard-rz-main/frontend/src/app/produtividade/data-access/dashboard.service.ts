import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Filtro, toParams } from '../models/filtro.model';
import { FiltrosOptions, Kpi, Ranking, Reinf, TaskType } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private base = '/api/dashboard';

  kpis(f: Filtro): Observable<Kpi> {
    return this.http.get<Kpi>(`${this.base}/kpis`, { params: toParams(f) });
  }

  ranking(f: Filtro): Observable<Ranking[]> {
    return this.http.get<Ranking[]>(`${this.base}/ranking`, { params: toParams(f) });
  }

  tiposTarefa(f: Filtro): Observable<TaskType[]> {
    return this.http.get<TaskType[]>(`${this.base}/tipos-tarefa`, { params: toParams(f) });
  }

  reinf(f: Filtro): Observable<Reinf> {
    return this.http.get<Reinf>(`${this.base}/reinf`, { params: toParams(f) });
  }

  filtros(): Observable<FiltrosOptions> {
    return this.http.get<FiltrosOptions>(`${this.base}/filtros`);
  }
}
