import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class ApproveReviewDto {
  @IsInt()
  @Min(1)
  employeeId: number;
}

export class NewEmployeeReviewDto {
  @IsString()
  @IsNotEmpty()
  canonicalName: string;

  @IsString()
  @IsNotEmpty()
  departamento: string;
}

export class ReviewQueueGrupoDto {
  id: number;
  rawName: string;
  rawDept: string;
  sourceFiles: string[];
  pendentes: number;
  criadoEm: string;
}

export class SugestaoColaboradorDto {
  employeeId: number;
  canonicalName: string;
  score: number;
}

export class ContagemPendentesDto {
  grupos: number;
  linhas: number;
}
