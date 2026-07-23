import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

function parseBoolean({ value }: { value: unknown }) {
  if (value === undefined) return undefined;
  return value === true || value === 'true' || value === '1';
}

function parseCsvArray({ value }: { value: unknown }) {
  if (value === undefined) return undefined;
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return arr.map((v) => String(v).trim()).filter(Boolean);
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

  /** CSV (ex.: "pendente,entregue"); ausente/vazio = sem restricao de status. */
  @IsOptional()
  @Transform(parseCsvArray)
  @IsArray()
  @IsIn(['pendente', 'justificada', 'entregue', 'dispensada'], { each: true })
  statusClasses?: string[];
}
