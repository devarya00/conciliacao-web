import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DashboardController } from './dashboard.controller';
import { ArquivosController } from './arquivos.controller';
import { ConfigController } from './config.controller';
import { IngestionReviewController } from './ingestion-review.controller';
import { ExpedienteController } from './expediente.controller';
import { DashboardService } from './dashboard.service';
import { ConfigService } from './config.service';
import { ExpedienteService } from './expediente.service';
import { IngestaoService } from './ingestao/ingestao.service';
import { IngestaoWorker } from './ingestao/ingestao.worker';
import { EmployeeResolutionService } from './ingestao/employee-resolution.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [DashboardController, ArquivosController, ConfigController, IngestionReviewController, ExpedienteController],
  providers: [DashboardService, ConfigService, ExpedienteService, IngestaoService, IngestaoWorker, EmployeeResolutionService],
})
export class DashboardModule {}
