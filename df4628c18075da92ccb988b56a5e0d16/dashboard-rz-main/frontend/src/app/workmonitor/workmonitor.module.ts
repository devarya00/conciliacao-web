import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsModule } from 'ngx-echarts';
import { ProdutividadeModule } from '../produtividade/produtividade.module';

import { WorkmonitorPageComponent } from './workmonitor-page.component';
import { WorkmonitorKpiCardsComponent } from './widgets/workmonitor-kpi-cards.component';
import { AnelProgressoComponent } from './widgets/anel-progresso.component';
import { StatusTempoComponent } from './widgets/status-tempo.component';
import { DispersaoProdutivoScoreComponent } from './widgets/dispersao-produtivo-score.component';
import { WorkmonitorTabelaComponent } from './widgets/workmonitor-tabela.component';

@NgModule({
  declarations: [
    WorkmonitorPageComponent,
    WorkmonitorKpiCardsComponent,
    AnelProgressoComponent,
    StatusTempoComponent,
    DispersaoProdutivoScoreComponent,
    WorkmonitorTabelaComponent,
  ],
  imports: [CommonModule, FormsModule, NgxEchartsModule, ProdutividadeModule],
  exports: [WorkmonitorPageComponent],
})
export class WorkmonitorModule {}
