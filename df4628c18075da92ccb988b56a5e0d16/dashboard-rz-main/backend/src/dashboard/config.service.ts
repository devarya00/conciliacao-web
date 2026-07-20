import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../db/knex.module';
import { ValorPontoDto, UpsertValorPontoDto } from './dto/valor-ponto.dto';

@Injectable()
export class ConfigService {
  constructor(@Inject(KNEX_CONNECTION) private readonly db: Knex) {}

  async listarValorPonto(): Promise<ValorPontoDto[]> {
    const rows = await this.db('config_valor_ponto').select('*').orderBy('competencia', 'desc');
    return rows.map((r: any) => ({ competencia: this.toIsoDate(r.competencia), valor: Number(r.valor) }));
  }

  async upsertValorPonto(dto: UpsertValorPontoDto): Promise<ValorPontoDto> {
    const competencia = `${dto.competencia.slice(0, 7)}-01`;
    const [row] = await this.db('config_valor_ponto')
      .insert({ competencia, valor: dto.valor })
      .onConflict('competencia')
      .merge()
      .returning('*');
    return { competencia: this.toIsoDate(row.competencia), valor: Number(row.valor) };
  }

  private toIsoDate(value: string | Date): string {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }
}
