import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ValorPonto } from '../models/config.model';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);
  private base = '/api/dashboard/config/valor-ponto';

  listarValorPonto(): Observable<ValorPonto[]> {
    return this.http.get<ValorPonto[]>(this.base);
  }

  salvarValorPonto(competencia: string, valor: number): Observable<ValorPonto> {
    return this.http.put<ValorPonto>(this.base, { competencia, valor });
  }
}
