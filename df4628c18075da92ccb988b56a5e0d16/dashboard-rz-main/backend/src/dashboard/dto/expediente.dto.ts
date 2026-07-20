import { ArrayNotEmpty, IsArray, IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';

export class ExpedienteConfigDto {
  diasUteis: number[]; // 0=domingo..6=sabado
  horaInicio: string; // 'HH:MM'
  horaFim: string; // 'HH:MM'
  fusoHorario: string;
}

export class UpdateExpedienteDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasUteis: number[];

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horaInicio deve ser HH:MM' })
  horaInicio: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horaFim deve ser HH:MM' })
  horaFim: string;
}

export class FeriadoDto {
  data: string; // 'YYYY-MM-DD'
  nome: string;
}

export class CreateFeriadoDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'data deve ser YYYY-MM-DD' })
  data: string;

  @IsString()
  @IsNotEmpty()
  nome: string;
}
