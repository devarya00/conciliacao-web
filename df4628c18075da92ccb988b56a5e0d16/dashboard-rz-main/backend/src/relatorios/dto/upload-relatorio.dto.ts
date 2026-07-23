import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class UploadRelatorioDto {
  @IsString()
  @IsNotEmpty()
  nomeEmpresa!: string;

  /** Formato "YYYY-MM" (valor cru do <input type="month">). */
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'competencia deve estar no formato YYYY-MM' })
  competencia!: string;
}
