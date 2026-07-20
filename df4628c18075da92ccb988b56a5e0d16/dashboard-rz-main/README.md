# Dashboard de Produtividade e Operações

Implementação conforme `Arquitetura_Dashboard_Produtividade.pdf`: consolidação Acessórias · Onvio ·
Workmonitor, backend NestJS + PostgreSQL, frontend Angular + ECharts.

```
dashboard/
├── backend/   # NestJS API + ETL (parser XLSX -> Postgres)
└── frontend/  # Angular + ngx-echarts
```

## Backend

```bash
cd backend
cp .env.example .env   # ajuste credenciais do Postgres
npm install
npm run migrate         # aplica src/db/migrations/*.sql
npm run start:dev       # API em http://localhost:3001/api (3000 esta ocupada por outro projeto local)
```

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
rotas. O gerador de relatório gerencial (`/api/relatorios/*`, PDFs Domínio -> xlsx) fica aberto a
qualquer usuário autenticado — é a ferramenta do funcionário. `/api/auth/login` é a única rota
pública. Token expira em `JWT_EXPIRES_IN` (padrão 8h); configure `JWT_SECRET` em produção (`.env` /
`docker-compose.yml`).

## Gerador de relatório gerencial

`POST /api/relatorios` (multipart: `nomeEmpresa`, `balancete` e `resumo`, os dois PDFs do Domínio)
roda `extract_pdfs.py` + `gen_xlsx.py` (`backend/src/relatorios/scripts/`) e devolve o job já
concluído com o xlsx pronto — sem fila, processamento é síncrono no próprio request. `GET
/api/relatorios` lista o histórico; `GET /api/relatorios/:id/download` baixa o xlsx; `DELETE
/api/relatorios/:id` remove o job e os arquivos. Requer `python3` + `pdfplumber`/`openpyxl` na
imagem (já no `Dockerfile`; fora de container, `pip install -r
backend/src/relatorios/scripts/requirements.txt`).

Universal entre empresas (testado com 2 empresas reais de estruturas bem diferentes):

- `extract_pdfs.py` já lia nome/CNPJ/período direto do PDF. Também lida com balancete exportado
  como **vários meses concatenados no mesmo PDF** (uma seção "Período: X-Y" por mês) — usa só a
  última seção (posição atual da empresa); os meses anteriores já estão embutidos no saldo
  anterior dela.
- `gen_xlsx.py` resolve toda conta do DRE/Balanço/Fornecedores pelo **nome** no plano de contas
  (`ATIVO CIRCULANTE`, `RECEITA BRUTA DE VENDAS E SERVIÇOS` etc. — plano de contas referencial
  padrão do Domínio), não por código numérico fixo (código varia de empresa pra empresa, nome não).
  Só `ATIVO` e `PASSIVO` (nível 1) são obrigatórias — sem elas o PDF nem é um balancete válido, e o
  job termina com `status: erro` + `erro_msg` dizendo qual conta faltou. Toda outra conta é
  opcional: se a empresa não movimentou ela naquele período (Domínio não imprime linha zerada) ou
  não tem aquele grupo (ex.: Passivo Não Circulante, Veículos), a linha some ou vira 0 em vez de
  quebrar o relatório. A aba Fiscal lista os acumuladores que existirem no resumo dessa empresa, sem
  lista fixa. A aba Verificações continua conferindo a integridade dos números — se sobrar uma diferença real
  (ex.: um resíduo entre DRE e variação patrimonial), aparece "ERRO" ali, não fica escondida.

## Frontend

```bash
cd frontend
npm install
npm start   # http://localhost:4200, proxy /api -> localhost:3001 (proxy.conf.json)
```

Duas abas: **Dashboard** (KPIs/gráficos) e **Planilhas** (upload, status de processamento e exclusão
das planilhas enviadas).

## Regras de negócio implementadas

- `status_class`: `Ent.*` → entregue; `Pendente`/`Atrasada!`/`Pend. justificada` → pendente;
  `Dispensada` → dispensada; demais → outro.
- `is_reinf`: `obrigacao ILIKE '%reinf%'`.
- Data mestre do filtro: `COALESCE(data_entrega, prazo_tecnico)`.
- `nome_key`: primeiro token do nome em maiúsculas — chave de merge Onvio ↔ Workmonitor.
- Ranking por funcionário vem de `fact_produtividade` (Onvio) + `fact_performance` (Workmonitor) via
  `nome_key`, nunca do S3D (que só traz rótulo de departamento em "Responsável entrega").
- Colaborador sem par no Workmonitor aparece com barra cinza no ranking (sem score).
