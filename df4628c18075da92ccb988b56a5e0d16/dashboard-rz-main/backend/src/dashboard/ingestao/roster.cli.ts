import 'dotenv/config';
import knex from 'knex';
import knexConfig from '../../db/knexfile';
import { IngestaoService } from './ingestao.service';
import { EmployeeResolutionService } from './employee-resolution.service';

/**
 * Reaplica o roster canonico (merges/inativos/rotulos) sobre dim_colaborador,
 * sem re-ingerir arquivos. Uso: `npm run roster:apply`. Idempotente.
 */
async function main() {
  const db = knex(knexConfig);
  const service = new IngestaoService(db as any, new EmployeeResolutionService(db as any));
  const r = await service.aplicarRosterCanonico();
  console.log(`[roster] merges=${r.merges} inativos=${r.inativos} nao_pessoa=${r.naoPessoa}`);
  await db.destroy();
}

main().catch((err) => {
  console.error('[roster] falhou:', err);
  process.exit(1);
});
