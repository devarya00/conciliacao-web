import { Component, Input } from '@angular/core';
import { Kpi } from '../models/dashboard.model';

type StatusTarefa = 'pendentes' | 'justificadas' | 'entregues' | 'dispensadas';

@Component({
  selector: 'app-kpi-cards',
  templateUrl: './kpi-cards.component.html',
  styleUrls: ['./kpi-cards.component.scss'],
})
export class KpiCardsComponent {
  @Input() kpi: Kpi | null = null;

  // Cards de status marcados por padrao (mostra tudo); desmarcar so esconde o
  // card - contagem em si sempre vem do backend, nao depende desse filtro.
  statusVisivel: Record<StatusTarefa, boolean> = {
    pendentes: true,
    justificadas: true,
    entregues: true,
    dispensadas: true,
  };
}
