import { Component, Input, OnChanges } from '@angular/core';
import type { EChartsOption } from 'echarts';
import { TaskType } from '../models/dashboard.model';

@Component({
  selector: 'app-tipos-tarefa',
  templateUrl: './tipos-tarefa.component.html',
  styleUrls: ['./tipos-tarefa.component.scss'],
})
export class TiposTarefaComponent implements OnChanges {
  @Input() tipos: TaskType[] | null = null;

  options: EChartsOption = {};

  ngOnChanges(): void {
    const dados = this.tipos ?? [];
    this.options = {
      color: ['#5AA9FF', '#8FE04A', '#9B7BFF', '#FF7AB2', '#FFC85A', '#64748B'],
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [
        {
          type: 'pie',
          radius: ['55%', '80%'],
          label: { show: false },
          data: dados.map((d) => ({ name: d.obrigacao, value: d.volume })),
        },
      ],
    };
  }
}
