import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IngestaoService } from './ingestao.service';

@Injectable()
export class IngestaoWorker {
  private readonly logger = new Logger(IngestaoWorker.name);

  constructor(private readonly ingestaoService: IngestaoService) {}

  /** Cadencia configuravel via INGESTAO_CRON (padrao: a cada 2h). */
  @Cron(process.env.INGESTAO_CRON || '0 */2 * * *')
  async executarAgendado() {
    this.logger.log('Iniciando ingestao agendada...');
    try {
      await this.ingestaoService.executar();
      this.logger.log('Ingestao agendada concluida.');
    } catch (err) {
      this.logger.error('Ingestao agendada falhou', err as Error);
    }
  }
}
