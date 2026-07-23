import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Kpi, STATUS_TAREFA_CLASSE, StatusTarefa } from '../models/dashboard.model';

@Component({
  selector: 'app-kpi-cards',
  templateUrl: './kpi-cards.component.html',
  styleUrls: ['./kpi-cards.component.scss'],
})
export class KpiCardsComponent {
  @Input() kpi: Kpi | null = null;

  // Cards de status marcados por padrao (mostra tudo). Alem de esconder/mostrar
  // o card, agora tambem filtra Ranking e Detalhamento de tarefas (statusChange).
  statusVisivel: Record<StatusTarefa, boolean> = {
    pendentes: true,
    justificadas: true,
    entregues: true,
    dispensadas: true,
  };

  @Output() statusChange = new EventEmitter<string[]>();

  onToggleStatus(): void {
    const selecionados = (Object.keys(this.statusVisivel) as StatusTarefa[])
      .filter((k) => this.statusVisivel[k])
      .map((k) => STATUS_TAREFA_CLASSE[k]);
    this.statusChange.emit(selecionados);
  }
}
