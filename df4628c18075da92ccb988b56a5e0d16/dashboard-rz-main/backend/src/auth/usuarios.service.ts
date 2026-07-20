import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { hash } from 'bcryptjs';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../db/knex.module';
import { Usuario, UsuarioRole } from './usuario.model';

const RESET_TOKEN_TTL_HORAS = 24;

export interface UsuarioResumo {
  id: number;
  email: string;
  role: UsuarioRole;
  ativo: boolean;
  created_at: string;
}

export interface LinkRedefinicao {
  token: string;
  expiraEm: string;
}

@Injectable()
export class UsuariosService {
  constructor(@Inject(KNEX_CONNECTION) private readonly db: Knex) {}

  async listar(): Promise<UsuarioResumo[]> {
    return this.db<Usuario>('usuarios')
      .select('id', 'email', 'role', 'ativo', 'created_at')
      .orderBy('created_at', 'desc');
  }

  /**
   * Cria (ou reativa/reatribui role de) um usuário sem senha utilizável — só
   * dá pra entrar depois de abrir o link de redefinição e escolher a própria
   * senha. Evita passar senha temporária por fora do sistema.
   */
  async criar(email: string, role: UsuarioRole): Promise<{ usuario: UsuarioResumo; link: LinkRedefinicao }> {
    const senhaPlaceholder = randomBytes(32).toString('hex');
    const senha_hash = await hash(senhaPlaceholder, 10);

    const [usuario] = await this.db<Usuario>('usuarios')
      .insert({ email: email.toLowerCase(), senha_hash, role, ativo: true })
      .onConflict('email')
      .merge({ role, ativo: true })
      .returning(['id', 'email', 'role', 'ativo', 'created_at']);

    const link = await this.gerarLinkRedefinicao(usuario.id);
    return { usuario, link };
  }

  async gerarLinkRedefinicao(usuarioId: number): Promise<LinkRedefinicao> {
    const token = randomBytes(32).toString('hex');
    const expiraEm = new Date(Date.now() + RESET_TOKEN_TTL_HORAS * 60 * 60 * 1000);

    const [row] = await this.db<Usuario>('usuarios')
      .where({ id: usuarioId })
      .update({ reset_token: token, reset_token_expires: expiraEm.toISOString() })
      .returning(['id']);
    if (!row) throw new NotFoundException('Usuário não encontrado');

    return { token, expiraEm: expiraEm.toISOString() };
  }

  async redefinirSenha(token: string, novaSenha: string): Promise<void> {
    const usuario = await this.db<Usuario>('usuarios').where({ reset_token: token }).first();
    if (!usuario || !usuario.reset_token_expires || new Date(usuario.reset_token_expires) < new Date()) {
      throw new BadRequestException('Link inválido ou expirado — peça um novo pro admin');
    }

    const senha_hash = await hash(novaSenha, 10);
    await this.db<Usuario>('usuarios')
      .where({ id: usuario.id })
      .update({ senha_hash, reset_token: null, reset_token_expires: null, ativo: true });
  }
}
