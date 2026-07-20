import { Component, Input } from '@angular/core';
import { Kpi } from '../models/dashboard.model';

@Component({
  selector: 'app-kpi-cards',
  templateUrl: './kpi-cards.component.html',
  styleUrls: ['./kpi-cards.component.scss'],
})
export class KpiCardsComponent {
  @Input() kpi: Kpi | null = null;
}
