import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { FiltroDto } from './dto/filtro.dto';
import { KpiDto } from './dto/kpi.dto';
import { SerieTempoDto } from './dto/serie-tempo.dto';
import { StatusTempoDto } from './dto/status-tempo.dto';
import { WorkmonitorColaboradorDto, WorkmonitorTotaisDto } from './dto/workmonitor.dto';
import { RankingDto } from './dto/ranking.dto';
import { TaskTypeDto } from './dto/task-type.dto';
import { ReinfDto } from './dto/reinf.dto';
import { FiltrosOptionsDto } from './dto/filtros-options.dto';
import { Roles } from '../auth/roles.decorator';

@Roles('admin')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  kpis(@Query() filtro: FiltroDto): Promise<KpiDto> {
    return this.dashboardService.kpis(filtro);
  }

  @Get('serie-tempo')
  serieTempo(@Query() filtro: FiltroDto): Promise<SerieTempoDto[]> {
    return this.dashboardService.serieTempo(filtro);
  }

  @Get('status-tempo')
  statusTempo(@Query() filtro: FiltroDto): Promise<StatusTempoDto[]> {
    return this.dashboardService.statusTempo(filtro);
  }

  @Get('workmonitor-totais')
  workmonitorTotais(@Query() filtro: FiltroDto): Promise<WorkmonitorTotaisDto> {
    return this.dashboardService.workmonitorTotais(filtro);
  }

  @Get('workmonitor-colaboradores')
  workmonitorColaboradores(@Query() filtro: FiltroDto): Promise<WorkmonitorColaboradorDto[]> {
    return this.dashboardService.workmonitorColaboradores(filtro);
  }

  @Get('ranking')
  ranking(@Query() filtro: FiltroDto): Promise<RankingDto[]> {
    return this.dashboardService.ranking(filtro);
  }

  @Get('tipos-tarefa')
  tiposTarefa(@Query() filtro: FiltroDto): Promise<TaskTypeDto[]> {
    return this.dashboardService.tiposTarefa(filtro);
  }

  @Get('reinf')
  reinf(@Query() filtro: FiltroDto): Promise<ReinfDto> {
    return this.dashboardService.reinf(filtro);
  }

  @Get('filtros')
  filtros(): Promise<FiltrosOptionsDto> {
    return this.dashboardService.filtros();
  }
}
