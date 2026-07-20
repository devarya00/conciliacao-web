import { Component, Input } from '@angular/core';
import { WorkmonitorTotais } from '../models/workmonitor.model';

@Component({
  selector: 'app-workmonitor-kpi-cards',
  templateUrl: './workmonitor-kpi-cards.component.html',
  styleUrls: ['./workmonitor-kpi-cards.component.scss'],
})
export class WorkmonitorKpiCardsComponent {
  @Input() totais: WorkmonitorTotais | null = null;

  formatarHms(segundos: number | undefined): string {
    if (segundos === undefined) return '—';
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
