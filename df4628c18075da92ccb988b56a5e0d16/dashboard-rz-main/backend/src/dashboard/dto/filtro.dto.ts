import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

function parseBoolean({ value }: { value: unknown }) {
  if (value === undefined) return undefined;
  return value === true || value === 'true' || value === '1';
}

export class FiltroDto {
  @IsDateString()
  dataInicial: string;

  @IsDateString()
  dataFinal: string;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  somenteReinf?: boolean;

  /**
   * true = le de v_entrega_dedup (ultima ocorrencia da chave natural vence -
   * reproduz o comportamento antigo de dedup na ingestao); false/ausente = le
   * fact_entrega bruta, contando cada reenvio/execucao recorrente.
   */
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  dedup?: boolean;

  @IsOptional()
  @IsString()
  @Type(() => String)
  departamento?: string; // 'Todos'

  @IsOptional()
  @IsString()
  colaborador?: string; // 'Todos'
}
