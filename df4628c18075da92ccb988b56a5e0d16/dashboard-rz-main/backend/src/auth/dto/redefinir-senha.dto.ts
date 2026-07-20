import { IsString, MinLength } from 'class-validator';

export class RedefinirSenhaDto {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @MinLength(8)
  novaSenha!: string;
}
