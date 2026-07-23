import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsModule } from 'ngx-echarts';

import { ProdutividadePageComponent } from './produtividade-page.component';
import { FiltrosSidebarComponent } from './filtros/filtros-sidebar.component';
import { KpiCardsComponent } from './widgets/kpi-cards.component';
import { RankingFuncionariosComponent } from './widgets/ranking-funcionarios.component';
import { TiposTarefaComponent } from './widgets/tipos-tarefa.component';
import { TermometroReinfComponent } from './widgets/termometro-reinf.component';
import { PontuacaoTabelaComponent } from './widgets/pontuacao-tabela.component';
import { EmpresasAtendidasComponent } from './widgets/empresas-atendidas.component';

@NgModule({
  declarations: [
    ProdutividadePageComponent,
    FiltrosSidebarComponent,
    KpiCardsComponent,
    RankingFuncionariosComponent,
    TiposTarefaComponent,
    TermometroReinfComponent,
    PontuacaoTabelaComponent,
    EmpresasAtendidasComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    NgxEchartsModule.forRoot({ echarts: () => import('echarts') }),
  ],
  exports: [ProdutividadePageComponent, FiltrosSidebarComponent, NgxEchartsModule],
})
export class ProdutividadeModule {}
