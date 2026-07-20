import { Component, OnInit } from '@angular/core';
import { catchError, EMPTY, Subject, switchMap } from 'rxjs';
import { WorkmonitorService } from './data-access/workmonitor.service';
import { Filtro } from '../produtividade/models/filtro.model';
import { FiltrosOptions } from '../produtividade/models/dashboard.model';
import { StatusTempo, WorkmonitorColaborador, WorkmonitorTotais } from './models/workmonitor.model';

@Component({
  selector: 'app-workmonitor-page',
  templateUrl: './workmonitor-page.component.html',
  styleUrls: ['./workmonitor-page.component.scss'],
})
export class WorkmonitorPageComponent implements OnInit {
  private filtro$ = new Subject<Filtro>();

  opcoesFiltro: FiltrosOptions | null = null;
  totais: WorkmonitorTotais | null = null;
  statusTempo: StatusTempo[] = [];
  colaboradores: WorkmonitorColaborador[] = [];
  erroCarregando = false;

  constructor(private readonly workmonitorService: WorkmonitorService) {}

  ngOnInit(): void {
    this.workmonitorService.filtros().subscribe((opcoes) => (this.opcoesFiltro = opcoes));

    this.filtro$
      .pipe(switchMap((f) => this.workmonitorService.totais(f).pipe(catchError(() => this.falhou()))))
      .subscribe((t) => t && (this.totais = t));
    this.filtro$
      .pipe(switchMap((f) => this.workmonitorService.statusTempo(f).pipe(catchError(() => this.falhou()))))
      .subscribe((s) => s && (this.statusTempo = s));
    this.filtro$
      .pipe(switchMap((f) => this.workmonitorService.colaboradores(f).pipe(catchError(() => this.falhou()))))
      .subscribe((c) => c && (this.colaboradores = c));
  }

  onFiltroChange(filtro: Filtro): void {
    this.erroCarregando = false;
    this.filtro$.next(filtro);
  }

  percentual(segundos: number | undefined, captadasTotal: number): number {
    if (!segundos || captadasTotal <= 0) return 0;
    return Math.round((segundos / captadasTotal) * 10000) / 100;
  }

  get captadasTotal(): number {
    if (!this.totais) return 0;
    return this.totais.produtivoS + this.totais.improdutivoS + this.totais.ocioS + this.totais.neutroS;
  }

  private falhou() {
    this.erroCarregando = true;
    return EMPTY;
  }
}
