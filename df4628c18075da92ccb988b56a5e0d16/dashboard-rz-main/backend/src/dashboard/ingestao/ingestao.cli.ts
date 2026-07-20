import 'dotenv/config';
import knex from 'knex';
import knexConfig from '../../db/knexfile';
import { IngestaoService } from './ingestao.service';
import { EmployeeResolutionService } from './employee-resolution.service';

/** Execucao manual: `npm run ingest` (fora do ciclo de vida do Nest, para uso via CLI/CI). */
async function main() {
  const db = knex(knexConfig);
  const service = new IngestaoService(db as any, new EmployeeResolutionService(db as any));
  await service.executar();
  await db.destroy();
}

main().catch((err) => {
  console.error('[ingest] falhou:', err);
  process.exit(1);
});
