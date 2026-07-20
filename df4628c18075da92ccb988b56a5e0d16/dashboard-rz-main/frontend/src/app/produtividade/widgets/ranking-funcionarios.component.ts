import { Component, Input, OnChanges } from '@angular/core';
import type { EChartsOption } from 'echarts';
import { Ranking } from '../models/dashboard.model';

const CINZA = '#CBD5E1'; // colaborador sem par no Workmonitor (sem score)

function corPorScore(score: number | null): string {
  if (score === null) return CINZA;
  if (score >= 80) return '#8FE04A';
  if (score >= 60) return '#5AA9FF';
  if (score >= 40) return '#9B7BFF';
  return '#FF7AB2';
}

@Component({
  selector: 'app-ranking-funcionarios',
  templateUrl: './ranking-funcionarios.component.html',
  styleUrls: ['./ranking-funcionarios.component.scss'],
})
export class RankingFuncionariosComponent implements OnChanges {
  @Input() ranking: Ranking[] | null = null;

  options: EChartsOption = {};

  ngOnChanges(): void {
    const dados = [...(this.ranking ?? [])].sort((a, b) => a.concluidos - b.concluidos);

    this.options = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = params[0];
          const item = dados[p.dataIndex];
          const score = item.scoreGenia !== null ? item.scoreGenia.toFixed(1) : 'sem par no Workmonitor';
          return `${item.nome}<br/>Concluídos: ${item.concluidos}<br/>Score gênia: ${score}`;
        },
      },
      grid: { left: 120, right: 24, top: 12, bottom: 24 },
      xAxis: { type: 'value' },
      yAxis: {
        type: 'category',
        data: dados.map((d) => d.nome),
      },
      series: [
        {
          type: 'bar',
          data: dados.map((d) => ({
            value: d.concluidos,
            itemStyle: { color: corPorScore(d.scoreGenia) },
          })),
        },
      ],
    };
  }
}
