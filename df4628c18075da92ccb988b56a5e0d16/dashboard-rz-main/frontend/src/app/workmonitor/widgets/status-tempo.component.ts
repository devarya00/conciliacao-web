import { Component, Input, OnChanges } from '@angular/core';
import type { EChartsOption } from 'echarts';
import { StatusTempo } from '../models/workmonitor.model';

function paraHoras(segundos: number): number {
  return Math.round((segundos / 3600) * 100) / 100;
}

function formatarHms(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

@Component({
  selector: 'app-status-tempo',
  templateUrl: './status-tempo.component.html',
  styleUrls: ['./status-tempo.component.scss'],
})
export class StatusTempoComponent implements OnChanges {
  @Input() serie: StatusTempo[] | null = null;

  options: EChartsOption = {};

  ngOnChanges(): void {
    const dados = this.serie ?? [];

    this.options = {
      color: ['#8BC34A', '#FFC107', '#F44336', '#29B6F6'],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v) => formatarHms(Math.round((v as number) * 3600)),
      },
      legend: { bottom: 0, data: ['Produtivo', 'Ocioso', 'Improdutivo', 'Neutro'] },
      grid: { left: 40, right: 20, top: 24, bottom: 40 },
      xAxis: {
        type: 'category',
        data: dados.map((d) => d.data.slice(8, 10)),
        name: 'Data',
      },
      yAxis: { type: 'value', show: false },
      series: [
        {
          name: 'Produtivo',
          type: 'bar',
          stack: 'status',
          data: dados.map((d) => paraHoras(d.produtivoS)),
        },
        {
          name: 'Ocioso',
          type: 'bar',
          stack: 'status',
          data: dados.map((d) => paraHoras(d.ocioS)),
        },
        {
          name: 'Improdutivo',
          type: 'bar',
          stack: 'status',
          data: dados.map((d) => paraHoras(d.improdutivoS)),
        },
        {
          name: 'Neutro',
          type: 'bar',
          stack: 'status',
          data: dados.map((d) => paraHoras(d.neutroS)),
        },
      ],
    };
  }
}
