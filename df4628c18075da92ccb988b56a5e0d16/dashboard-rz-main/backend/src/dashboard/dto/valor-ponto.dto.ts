import { IsDateString, IsNumber, Min } from 'class-validator';

export class ValorPontoDto {
  competencia: string;
  valor: number;
}

export class UpsertValorPontoDto {
  @IsDateString()
  competencia: string; // YYYY-MM-01 (dia 1 do mes de vigencia)

  @IsNumber()
  @Min(0)
  valor: number;
}
