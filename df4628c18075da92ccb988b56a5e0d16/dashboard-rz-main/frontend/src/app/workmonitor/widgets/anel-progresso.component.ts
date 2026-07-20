import { Component, Input, OnChanges } from '@angular/core';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-anel-progresso',
  templateUrl: './anel-progresso.component.html',
  styleUrls: ['./anel-progresso.component.scss'],
})
export class AnelProgressoComponent implements OnChanges {
  @Input() percentual = 0;
  @Input() cor = '#5AA9FF';
  @Input() titulo = '';

  options: EChartsOption = {};

  ngOnChanges(): void {
    this.options = {
      series: [
        {
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          min: 0,
          max: 100,
          radius: '92%',
          pointer: { show: false },
          progress: { show: true, width: 12, itemStyle: { color: this.cor } },
          axisLine: { lineStyle: { width: 12, color: [[1, '#eef1f6']] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, 0],
            fontSize: 20,
            fontWeight: 700,
            color: '#1e293b',
            formatter: (v: number) => `${v.toFixed(2)}%`,
          },
          data: [{ value: this.percentual }],
        },
      ],
    };
  }
}
