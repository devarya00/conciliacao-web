import { IsNotEmpty, IsString } from 'class-validator';

export class UploadRelatorioDto {
  @IsString()
  @IsNotEmpty()
  nomeEmpresa!: string;
}
