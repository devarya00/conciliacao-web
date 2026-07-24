# Dashboard de Produtividade e Operações

Implementação conforme `Arquitetura_Dashboard_Produtividade.pdf`: consolidação Acessórias · Onvio ·
Workmonitor, backend NestJS + PostgreSQL, frontend Angular + ECharts.

```
dashboard/
├── backend/   # NestJS API + ETL (parser XLSX -> Postgres)
└── frontend/  # Angular + ngx-echarts (deploy: Vercel)
```

## Backend

```bash
cd backend
cp .env.example .env   # ajuste credenciais do Postgres
npm install
npm run migrate         # aplica src/db/migrations/*.sql
npm run start:dev       # API em http://localhost:3001/api (3000 esta ocupada por outro projeto local)
```

### Banco: local vs produção

`docker-compose.yml` sobe Postgres **local** (container `db`) — de propósito, não aponta pra Neon
nem nenhum banco gerenciado. `docker compose up` tem que funcionar sozinho, sem credencial externa
nenhuma, e ambiente de dev não pode escrever no banco que produção usa. `knexfile.ts` só olha pra
`DATABASE_URL` (Postgres gerenciado, exige SSL) se ela existir; sem ela, cai nas variáveis
`PGHOST`/`PGPORT`/etc do Postgres local. **A única coisa que muda entre dev e produção é essa
variável** — `DATABASE_URL` vazia/ausente = local; preenchida (ex.: connection string do Neon) =
produção. Nunca configure `DATABASE_URL` no `docker-compose.yml` local.

Sem TypeORM/`synchronize` aqui — é Knex com SQL cru (`src/db/migrations/*.sql`), sempre migration
explícita, dev e produção rodam o **mesmo** `npm run migrate`, não tem modo "auto-schema" pra
divergir silenciosamente. A garantia de que migration sempre roda antes do app subir já existe no
`Dockerfile`: `CMD ["sh", "-c", "npm run migrate && npm run start:prod"]` — vale pra qualquer
ambiente que use essa imagem (local via `docker-compose`, ou produção apontando pra
`DATABASE_URL`), já que é o mesmo `CMD`, só a env var muda. **Só quebra se produção não usar essa
imagem** (deploy manual rodando `node dist/main` direto, por exemplo) — nesse caso, `npm run
migrate` precisa ser chamado à mão antes de cada deploy, sempre.

### Ingestão

Duas formas de entrada, ambas caem no mesmo pipeline e ficam rastreadas em `arquivo_ingestao`:

1. **Upload pela aba "Planilhas" do frontend** (recomendado) — `POST /api/dashboard/arquivos`
   (multipart: campo `arquivo` + campo `origem`). Fica salvo em `backend/data/uploads/`.
2. **Pasta manual** `backend/data/` (nomes precisam conter, sem case-sensitivity):
   - `s3d` → S3D_gestao_de_entregas
   - `estatisticas-funcionarios` → produtividade Onvio
   - `estatisticas-satisfa...` → satisfação Onvio
   - `workmonitor` → Workmonitor_performance

   Rodar manualmente com `npm run ingest`, ou deixar a rotina agendada via `@nestjs/schedule`
   (cron configurável em `INGESTAO_CRON`, padrão a cada 2h) — ver `ingestao.worker.ts`.

Ambas as formas são idempotentes: um arquivo com o mesmo nome + origem já processado não é
reingerido. `GET /api/dashboard/arquivos` lista todas as planilhas enviadas (status, registros
gerados); `DELETE /api/dashboard/arquivos/:id` remove o arquivo físico e, via `ON DELETE CASCADE` +
trigger em `002_arquivos_ingestao.sql`, apaga só os dados que vieram dele (`fact_entrega`,
`fact_produtividade`, `fact_performance` ou a nota de satisfação, conforme a origem).

**Atenção**: os nomes de coluna dos parsers (`src/dashboard/ingestao/parsers/*.ts`) foram inferidos a
partir da especificação do documento. Ao receber os arquivos reais, confira os headers e ajuste as
listas de candidatos em `pick(row, [...])` se necessário.

## Autenticação

Login obrigatório (JWT) em toda a API e no frontend; **não existe cadastro público** — usuários são
criados direto no banco:

```bash
cd backend
npm run user:create -- email@dominio.com "senha" admin   # role: admin | user (default user)
```

Só a role `admin` acessa o BI (`/api/dashboard/*`, `/api/ingestion/*`); `user` recebe 403 nessas
rotas e hoje não tem nenhuma tela própria no frontend (o gerador de relatório gerencial, único
destino dela, foi removido — ver histórico do git se precisar recuperar). `/api/auth/login` é a
única rota pública. Token expira em `JWT_EXPIRES_IN` (padrão 8h); configure `JWT_SECRET` em
produção (`.env` / `docker-compose.yml`).

## Frontend

```bash
cd frontend
npm install
npm start   # http://localhost:4200, proxy /api -> localhost:3001 (proxy.conf.json)
```

Duas abas: **Dashboard** (KPIs/gráficos) e **Planilhas** (upload, status de processamento e exclusão
das planilhas enviadas).

Deploy em produção: **Vercel**. Frontend e backend ficam em domínios separados — sem proxy
same-origin na frente, então `environment.production.ts` (`apiUrl`) precisa apontar pra URL absoluta
do backend, `frontend/src/index.html` (`connect-src` do CSP) precisa liberar essa origem, e o backend
precisa incluir o domínio da Vercel em `CORS_ALLOWED_ORIGINS`. Ver comentários nesses três arquivos.

## Regras de negócio implementadas

- `status_class`: `Ent.*` → entregue; `Pendente`/`Atrasada!`/`Pend. justificada` → pendente;
  `Dispensada` → dispensada; demais → outro.
- `is_reinf`: `obrigacao ILIKE '%reinf%'`.
- Data mestre do filtro: `COALESCE(data_entrega, prazo_tecnico)`.
- `nome_key`: primeiro token do nome em maiúsculas — chave de merge Onvio ↔ Workmonitor.
- Ranking por funcionário vem de `fact_produtividade` (Onvio) + `fact_performance` (Workmonitor) via
  `nome_key`, nunca do S3D (que só traz rótulo de departamento em "Responsável entrega").
- Colaborador sem par no Workmonitor aparece com barra cinza no ranking (sem score).
