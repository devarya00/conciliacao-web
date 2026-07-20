import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';
import { AuthUser, UsuarioRole } from './usuario.model';

/**
 * Roda depois do JwtAuthGuard. Sem @Roles() no handler/controller, qualquer
 * usuário autenticado passa; com @Roles('admin'), só essa role passa — é o
 * caso do BI (dashboard/*), enquanto o gerador de relatórios fica aberto a
 * qualquer autenticado.
 */
@Injectable()
export class RolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<UsuarioRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = req.user;
    if (!user) throw new ForbiddenException('Não autenticado');

    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Acesso restrito à role ${requiredRoles.join('/')}`);
    }
    return true;
  }
}
