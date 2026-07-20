import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { Filtro } from '../models/filtro.model';
import { FiltrosOptions } from '../models/dashboard.model';

@Component({
  selector: 'app-filtros-sidebar',
  templateUrl: './filtros-sidebar.component.html',
  styleUrls: ['./filtros-sidebar.component.scss'],
})
export class FiltrosSidebarComponent implements OnInit, OnChanges {
  @Input() opcoes: FiltrosOptions | null = null;
  @Input() mostrarReinf = true;
  @Output() filtroChange = new EventEmitter<Filtro>();

  dataInicial = '';
  dataFinal = '';
  somenteReinf = false;
  // ligado por padrao: reproduz a leitura classica (reenvio/atualizacao da mesma
  // obrigacao conta uma vez - ultima ocorrencia vence). Desligar conta cada
  // repeticao, incluindo execucoes diarias de tarefas recorrentes.
  dedup = true;
  departamento = 'Todos';
  colaborador = 'Todos';

  private inicializado = false;

  ngOnInit(): void {
    // fallback caso /filtros demore/falhe: mes atual. Sobrescrito por
    // ngOnChanges assim que `opcoes` chegar com o range real dos dados.
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    this.dataInicial = inicioMes.toISOString().slice(0, 10);
    this.dataFinal = hoje.toISOString().slice(0, 10);
    this.emitir();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.inicializado || !changes['opcoes'] || !this.opcoes?.minData || !this.opcoes?.maxData) return;
    this.inicializado = true;
    this.dataInicial = this.opcoes.minData;
    this.dataFinal = this.opcoes.maxData;
    this.emitir();
  }

  emitir(): void {
    this.filtroChange.emit({
      dataInicial: this.dataInicial,
      dataFinal: this.dataFinal,
      somenteReinf: this.somenteReinf,
      dedup: this.dedup,
      departamento: this.departamento,
      colaborador: this.colaborador,
    });
  }
}
