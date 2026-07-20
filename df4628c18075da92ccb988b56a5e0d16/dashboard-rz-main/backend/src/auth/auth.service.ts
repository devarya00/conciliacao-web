import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../db/knex.module';
import { AuthUser, Usuario } from './usuario.model';

@Injectable()
export class AuthService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly db: Knex,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, senha: string): Promise<{ access_token: string; user: AuthUser }> {
    const usuario = await this.db<Usuario>('usuarios').where({ email: email.toLowerCase() }).first();

    if (!usuario || !usuario.ativo || !(await compare(senha, usuario.senha_hash))) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    const user: AuthUser = { id: usuario.id, email: usuario.email, role: usuario.role };
    const access_token = await this.jwtService.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { access_token, user };
  }
}
