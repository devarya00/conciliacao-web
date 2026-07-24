import 'dotenv/config';
import type { Knex } from 'knex';

// DATABASE_URL (Neon/qualquer Postgres gerenciado, exige SSL) tem prioridade;
// sem ela, cai nas variáveis PG* discretas (Postgres local do docker-compose,
// sem SSL). rejectUnauthorized:true valida o certificado contra a CA
// confiável padrão do Node — Neon (e a maioria dos gerenciados) usa cadeia
// pública, então não precisa de CA customizada; sem isso, um MITM na rede
// entre backend e banco passaria despercebido.
const connection: Knex.PgConnectionConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'dashboard_produtividade',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
    };

const config: Knex.Config = {
  client: 'pg',
  connection,
  pool: { min: 2, max: 10 },
};

export default config;
