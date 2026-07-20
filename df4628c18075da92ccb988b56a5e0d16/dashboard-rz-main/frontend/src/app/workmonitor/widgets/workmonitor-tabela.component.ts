import { Component, Input } from '@angular/core';
import { WorkmonitorColaborador } from '../models/workmonitor.model';

@Component({
  selector: 'app-workmonitor-tabela',
  templateUrl: './workmonitor-tabela.component.html',
  styleUrls: ['./workmonitor-tabela.component.scss'],
})
export class WorkmonitorTabelaComponent {
  @Input() linhas: WorkmonitorColaborador[] = [];

  formatarHms(segundos: number): string {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
