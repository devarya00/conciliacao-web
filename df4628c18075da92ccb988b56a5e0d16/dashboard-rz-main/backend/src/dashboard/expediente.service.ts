import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../db/knex.module';
import { businessDurationSeconds, ExpedienteConfig } from '../common/business-time.util';
import { CreateFeriadoDto, ExpedienteConfigDto, FeriadoDto, UpdateExpedienteDto } from './dto/expediente.dto';

/**
 * Config de tempo util (business calendar) - dias uteis, janela de expediente
 * e feriados, cacheados em memoria (mesmo padrao de EmployeeResolutionService)
 * e invalidados a cada update. `businessDuration()` e o ponto de entrada que
 * qualquer metrica de tempo (ociosidade, resolucao, atraso, SLA) deve usar em
 * vez de `fim - inicio` corrido.
 */
@Injectable()
export class ExpedienteService {
  private cache: ExpedienteConfig | null = null;

  constructor(@Inject(KNEX_CONNECTION) private readonly db: Knex) {}

  invalidateCache(): void {
    this.cache = null;
  }

  async getConfig(): Promise<ExpedienteConfig> {
    if (this.cache) return this.cache;

    const [row, feriados] = await Promise.all([
      this.db('expediente_config').where({ id: 1 }).first(),
      this.db('feriado').select('data'),
    ]);

    this.cache = {
      diasUteis: new Set<number>(row.dias_uteis),
      horaInicioMinutos: this.horaParaMinutos(row.hora_inicio),
      horaFimMinutos: this.horaParaMinutos(row.hora_fim),
      feriados: new Set(feriados.map((f: any) => this.toIsoDate(f.data))),
      timeZone: row.fuso_horario,
    };
    return this.cache;
  }

  /** Ponto de entrada pro pipeline de metricas: duracao em segundos contando so tempo util. */
  async businessDuration(start: Date | string, end: Date | string): Promise<number> {
    const config = await this.getConfig();
    return businessDurationSeconds(start, end, config);
  }

  async getConfigDto(): Promise<ExpedienteConfigDto> {
    const row = await this.db('expediente_config').where({ id: 1 }).first();
    return {
      diasUteis: row.dias_uteis,
      horaInicio: this.horaParaTexto(row.hora_inicio),
      horaFim: this.horaParaTexto(row.hora_fim),
      fusoHorario: row.fuso_horario,
    };
  }

  async updateConfig(dto: UpdateExpedienteDto): Promise<ExpedienteConfigDto> {
    await this.db('expediente_config')
      .where({ id: 1 })
      .update({
        dias_uteis: dto.diasUteis,
        hora_inicio: dto.horaInicio,
        hora_fim: dto.horaFim,
        atualizado_em: this.db.fn.now(),
      });
    this.invalidateCache();
    return this.getConfigDto();
  }

  async listarFeriados(): Promise<FeriadoDto[]> {
    const rows = await this.db('feriado').select('*').orderBy('data', 'asc');
    return rows.map((r: any) => ({ data: this.toIsoDate(r.data), nome: r.nome }));
  }

  async adicionarFeriado(dto: CreateFeriadoDto): Promise<FeriadoDto> {
    const [row] = await this.db('feriado').insert({ data: dto.data, nome: dto.nome }).onConflict('data').merge().returning('*');
    this.invalidateCache();
    return { data: this.toIsoDate(row.data), nome: row.nome };
  }

  async removerFeriado(data: string): Promise<void> {
    const apagados = await this.db('feriado').where({ data }).delete();
    if (apagados === 0) throw new NotFoundException(`feriado ${data} nao encontrado`);
    this.invalidateCache();
  }

  private horaParaMinutos(valor: string): number {
    const [h, m] = String(valor).slice(0, 5).split(':').map(Number);
    return h * 60 + m;
  }

  private horaParaTexto(valor: string): string {
    return String(valor).slice(0, 5);
  }

  private toIsoDate(value: string | Date): string {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }
}
