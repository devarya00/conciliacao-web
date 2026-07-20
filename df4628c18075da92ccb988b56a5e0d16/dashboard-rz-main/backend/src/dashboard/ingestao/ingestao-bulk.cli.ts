import 'dotenv/config';
import knex from 'knex';
import knexConfig from '../../db/knexfile';
import { IngestaoService } from './ingestao.service';
import { EmployeeResolutionService } from './employee-resolution.service';

/**
 * Carga em lote de um diretorio inteiro (recursivo) para o banco.
 * Uso: `npm run ingest:bulk -- <dir>`  ou  `BULK_DIR=<dir> npm run ingest:bulk`.
 * Idempotente (dedup por hash de conteudo); pode rodar quantas vezes quiser.
 */
async function main() {
  const dir = process.argv[2] || process.env.BULK_DIR || './data/carga';
  const db = knex(knexConfig);
  const service = new IngestaoService(db as any, new EmployeeResolutionService(db as any));

  console.log(`[ingest:bulk] carregando de ${dir} ...`);
  const resumo = await service.ingerirTodos(dir);

  console.log(`\n[ingest:bulk] ${resumo.total} arquivo(s) reconhecido(s):`);
  for (const [origem, c] of Object.entries(resumo.porOrigem)) {
    if (c.processado || c.pulado || c.erro) {
      console.log(`  ${origem.padEnd(22)} processado=${c.processado} pulado=${c.pulado} erro=${c.erro}`);
    }
  }
  if (resumo.erros.length) {
    console.log(`\n[ingest:bulk] erros:`);
    for (const e of resumo.erros) console.log(`  - ${e.arquivo}: ${e.mensagem}`);
  }

  await db.destroy();
}

main().catch((err) => {
  console.error('[ingest:bulk] falhou:', err);
  process.exit(1);
});
