import { IsEmail, IsIn } from 'class-validator';
import { UsuarioRole } from '../usuario.model';

export class CriarUsuarioDto {
  @IsEmail()
  email!: string;

  @IsIn(['admin', 'user'])
  role!: UsuarioRole;
}
