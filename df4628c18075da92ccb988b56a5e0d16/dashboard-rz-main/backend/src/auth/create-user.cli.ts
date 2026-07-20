import 'dotenv/config';
import { hash } from 'bcryptjs';
import knex from 'knex';
import knexConfig from '../db/knexfile';
import { UsuarioRole } from './usuario.model';

/**
 * Cria/atualiza um usuário direto no banco (não existe cadastro público).
 * Uso: npm run user:create -- email@dominio.com "senha" admin
 * Role default: user.
 */
async function main() {
  const [email, senha, roleArg] = process.argv.slice(2);
  if (!email || !senha) {
    console.error('Uso: npm run user:create -- email@dominio.com "senha" [admin|user]');
    process.exit(1);
  }
  const role: UsuarioRole = roleArg === 'admin' ? 'admin' : 'user';

  const db = knex(knexConfig);
  const senha_hash = await hash(senha, 10);

  const [row] = await db('usuarios')
    .insert({ email: email.toLowerCase(), senha_hash, role, ativo: true })
    .onConflict('email')
    .merge({ senha_hash, role, ativo: true })
    .returning(['id', 'email', 'role']);

  console.log(`[user:create] usuário salvo: id=${row.id} email=${row.email} role=${row.role}`);
  await db.destroy();
}

main().catch((err) => {
  console.error('[user:create] falhou:', err);
  process.exit(1);
});
