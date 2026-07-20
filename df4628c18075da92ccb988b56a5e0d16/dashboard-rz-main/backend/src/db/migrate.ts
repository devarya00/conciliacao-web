import 'dotenv/config';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import knex from 'knex';
import config from './knexfile';

/** Executa os .sql de migrations/ em ordem alfabetica, dentro de uma transacao. */
async function main() {
  const db = knex(config);
  const dir = join(__dirname, 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  await db.transaction(async (trx) => {
    for (const file of files) {
      const sql = readFileSync(join(dir, file), 'utf-8');
      // eslint-disable-next-line no-console
      console.log(`[migrate] aplicando ${file}`);
      await trx.raw(sql);
    }
  });

  console.log(`[migrate] ${files.length} arquivo(s) aplicado(s) com sucesso.`);
  await db.destroy();
}

main().catch((err) => {
  console.error('[migrate] falhou:', err);
  process.exit(1);
});
