import { Component, OnInit } from '@angular/core';
import { catchError, EMPTY, Subject, switchMap } from 'rxjs';
import { DashboardService } from './data-access/dashboard.service';
import { Filtro } from './models/filtro.model';
import { FiltrosOptions, Kpi, Ranking, Reinf, TaskType } from './models/dashboard.model';

@Component({
  selector: 'app-produtividade-page',
  templateUrl: './produtividade-page.component.html',
  styleUrls: ['./produtividade-page.component.scss'],
})
export class ProdutividadePageComponent implements OnInit {
  private filtro$ = new Subject<Filtro>();

  opcoesFiltro: FiltrosOptions | null = null;
  kpi: Kpi | null = null;
  ranking: Ranking[] = [];
  tiposTarefa: TaskType[] = [];
  reinf: Reinf | null = null;
  erroCarregando = false;

  constructor(private readonly dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.dashboardService.filtros().subscribe((opcoes) => (this.opcoesFiltro = opcoes));

    this.filtro$
      .pipe(switchMap((f) => this.dashboardService.kpis(f).pipe(catchError(() => this.falhou()))))
      .subscribe((k) => k && (this.kpi = k));
    this.filtro$
      .pipe(switchMap((f) => this.dashboardService.ranking(f).pipe(catchError(() => this.falhou()))))
      .subscribe((r) => r && (this.ranking = r));
    this.filtro$
      .pipe(switchMap((f) => this.dashboardService.tiposTarefa(f).pipe(catchError(() => this.falhou()))))
      .subscribe((t) => t && (this.tiposTarefa = t));
    this.filtro$
      .pipe(switchMap((f) => this.dashboardService.reinf(f).pipe(catchError(() => this.falhou()))))
      .subscribe((r) => r && (this.reinf = r));
  }

  onFiltroChange(filtro: Filtro): void {
    this.erroCarregando = false;
    this.filtro$.next(filtro);
  }

  /** Mantem a subscription viva (switchMap mata o pipe se deixar o erro subir) e mostra aviso. */
  private falhou() {
    this.erroCarregando = true;
    return EMPTY;
  }
}
