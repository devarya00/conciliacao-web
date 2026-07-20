import { SetMetadata } from '@nestjs/common';
import { UsuarioRole } from './usuario.model';

export const ROLES_KEY = 'roles';

/** Restringe a rota/controller às roles informadas. Sem decorator = qualquer usuário autenticado. */
export const Roles = (...roles: UsuarioRole[]) => SetMetadata(ROLES_KEY, roles);
