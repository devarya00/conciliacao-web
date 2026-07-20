import { Component, Input, OnChanges } from '@angular/core';
import type { EChartsOption } from 'echarts';
import { WorkmonitorColaborador } from '../models/workmonitor.model';

@Component({
  selector: 'app-dispersao-produtivo-score',
  templateUrl: './dispersao-produtivo-score.component.html',
  styleUrls: ['./dispersao-produtivo-score.component.scss'],
})
export class DispersaoProdutivoScoreComponent implements OnChanges {
  @Input() dados: WorkmonitorColaborador[] = [];

  options: EChartsOption = {};

  ngOnChanges(): void {
    const pontos = this.dados
      .filter((d) => d.score !== null)
      .map((d) => ({ name: d.nome, value: [Math.round((d.produtivoS / 3600) * 100) / 100, d.score] }));

    this.options = {
      color: ['#5AA9FF'],
      tooltip: {
        formatter: (p: any) => `${p.data.name}<br/>Tempo produtivo: ${p.data.value[0]}h<br/>Score: ${p.data.value[1].toFixed(2)}`,
      },
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      xAxis: { type: 'value', name: 'Tempo produtivo (h)', nameLocation: 'middle', nameGap: 28 },
      yAxis: { type: 'value', name: 'Score', nameLocation: 'middle', nameGap: 36 },
      series: [
        {
          type: 'scatter',
          symbolSize: 14,
          data: pontos,
          label: { show: true, formatter: (p: any) => p.data.name, position: 'top', fontSize: 11, color: '#64748b' },
        },
      ],
    };
  }
}
