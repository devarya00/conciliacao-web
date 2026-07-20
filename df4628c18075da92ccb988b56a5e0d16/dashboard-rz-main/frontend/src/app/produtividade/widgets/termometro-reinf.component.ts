import { Component, Input, OnChanges } from '@angular/core';
import type { EChartsOption } from 'echarts';
import { Reinf } from '../models/dashboard.model';

@Component({
  selector: 'app-termometro-reinf',
  templateUrl: './termometro-reinf.component.html',
  styleUrls: ['./termometro-reinf.component.scss'],
})
export class TermometroReinfComponent implements OnChanges {
  @Input() reinf: Reinf | null = null;

  options: EChartsOption = {};

  ngOnChanges(): void {
    const pct = this.reinf?.percentualConclusao ?? 0;
    this.options = {
      series: [
        {
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          radius: '90%',
          pointer: { show: false },
          progress: { show: true, overlap: false, roundCap: true, clip: false, itemStyle: { color: '#9B7BFF' } },
          axisLine: { lineStyle: { width: 18, color: [[1, '#EEF1F6']] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          data: [{ value: pct }],
          detail: {
            valueAnimation: true,
            formatter: '{value}%',
            fontSize: 28,
            fontWeight: 700,
            color: '#334155',
            offsetCenter: [0, 0],
          },
          title: { show: false },
        },
      ],
    };
  }
}
