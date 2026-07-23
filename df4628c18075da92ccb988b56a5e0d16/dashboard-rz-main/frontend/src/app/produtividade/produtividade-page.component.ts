import { Component, OnInit } from '@angular/core';
import { BehaviorSubject, catchError, combineLatest, EMPTY, map, Subject, switchMap } from 'rxjs';
import { DashboardService } from './data-access/dashboard.service';
import { Filtro } from './models/filtro.model';
import { EmpresaAtendida, FiltrosOptions, Kpi, Ranking, Reinf, STATUS_TAREFA_CLASSE, TaskType } from './models/dashboard.model';

@Component({
  selector: 'app-produtividade-page',
  templateUrl: './produtividade-page.component.html',
  styleUrls: ['./produtividade-page.component.scss'],
})
export class ProdutividadePageComponent implements OnInit {
  private filtro$ = new Subject<Filtro>();
  // Mesmo default do KpiCardsComponent (todos os status marcados) - filtro dos
  // cards de status, tambem usado por Empresas atendidas, Ranking e Detalhamento.
  private statusClasses$ = new BehaviorSubject<string[]>(Object.values(STATUS_TAREFA_CLASSE));

  opcoesFiltro: FiltrosOptions | null = null;
  kpi: Kpi | null = null;
  ranking: Ranking[] = [];
  tiposTarefa: TaskType[] = [];
  empresasAtendidas: EmpresaAtendida[] = [];
  reinf: Reinf | null = null;
  erroCarregando = false;

  constructor(private readonly dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.dashboardService.filtros().subscribe((opcoes) => (this.opcoesFiltro = opcoes));

    const filtroComStatus$ = combineLatest([this.filtro$, this.statusClasses$]).pipe(
      map(([f, statusClasses]) => ({ ...f, statusClasses })),
    );

    filtroComStatus$
      .pipe(switchMap((f) => this.dashboardService.kpis(f).pipe(catchError(() => this.falhou()))))
      .subscribe((k) => k && (this.kpi = k));
    filtroComStatus$
      .pipe(switchMap((f) => this.dashboardService.ranking(f).pipe(catchError(() => this.falhou()))))
      .subscribe((r) => r && (this.ranking = r));
    filtroComStatus$
      .pipe(switchMap((f) => this.dashboardService.tiposTarefa(f).pipe(catchError(() => this.falhou()))))
      .subscribe((t) => t && (this.tiposTarefa = t));
    filtroComStatus$
      .pipe(switchMap((f) => this.dashboardService.empresasAtendidas(f).pipe(catchError(() => this.falhou()))))
      .subscribe((e) => e && (this.empresasAtendidas = e));
    this.filtro$
      .pipe(switchMap((f) => this.dashboardService.reinf(f).pipe(catchError(() => this.falhou()))))
      .subscribe((r) => r && (this.reinf = r));
  }

  onFiltroChange(filtro: Filtro): void {
    this.erroCarregando = false;
    this.filtro$.next(filtro);
  }

  onStatusChange(statusClasses: string[]): void {
    this.statusClasses$.next(statusClasses);
  }

  /** Mantem a subscription viva (switchMap mata o pipe se deixar o erro subir) e mostra aviso. */
  private falhou() {
    this.erroCarregando = true;
    return EMPTY;
  }
}
