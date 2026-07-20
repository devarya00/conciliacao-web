# Dashboard de Produtividade e Operações

Implementação conforme `Arquitetura_Dashboard_Produtividade.pdf`: consolidação Acessórias · Onvio ·
Workmonitor, backend NestJS + PostgreSQL, frontend Angular + ECharts.

```
dashboard/
├── backend/   # NestJS API + ETL (parser XLSX -> Postgres)
├── frontend/  # Angular + ngx-echarts
└── desktop/   # wrapper Electron (Windows) — cliente fino do frontend
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

## Desktop (Windows)

Wrapper Electron em `desktop/` — pacote isolado, dependências próprias (não usa nada de
`backend/`/`frontend/`). É um **cliente fino**: empacota só o build do Angular; fala com o backend
via `config.json` (`apiBaseUrl`), sem Postgres/Nest embutido no instalador.

Build e empacotamento rodam **só no GitHub Actions** (`windows-latest`, workflow
`.github/workflows/release.yml`) — não é suportado gerar o `.exe` localmente no Arch. Dispara em
push de tag `v*` (ex.: `v1.2.0` — sincroniza `desktop/package.json` com esse número antes de
buildar) ou manualmente (`workflow_dispatch`, sem sincronizar versão). Node LTS com cache de npm
(`frontend/package-lock.json` + `desktop/package-lock.json`). Builda o Angular em produção com
`--base-href ./` (necessário pro `file://` resolver os assets certo — com `/` absoluto ele tenta
carregar da raiz do sistema de arquivos), copia o `dist/` pra `desktop/app/`, grava a URL do backend
em `desktop/config.json` e libera essa origem no CSP (variável de repositório `DASHBOARD_API_URL`) e
empacota + publica com `electron-builder --win --x64 --publish always` (`GH_TOKEN:
${{ secrets.GITHUB_TOKEN }}`, permissão `contents: write` no job — cria/atualiza a release do
GitHub sozinho, sem step separado de upload). Bloco de assinatura via **Azure Trusted Signing**
comentado no workflow, pronto pra descomentar quando tiver conta/perfil provisionados (precisa
trocar `--publish always` por `never` + assinar + publish separado depois — tem nota explicando
isso junto do bloco).

`artifactName` fixo (`Dashboard Rezende-Setup-x64.exe`, sem número de versão) — mesmo nome de
arquivo em toda release, útil pra link de download fixo/atalho. `files` restrito a
`main.js`/`preload.js`/`config.json`/`package.json`/`app/**/*` (sem `.map`) — nada de `frontend/src`
(TS) nem `backend/` entra no pacote; testei com `electron-builder --dir` local e conferi o
`app.asar` gerado pra confirmar.

**`main.js`**: carrega `app/index.html` direto via `file://` (`loadFile`, sem servidor local).
`BrowserWindow` com `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Navegação
externa (`will-navigate`, `setWindowOpenHandler` — `window.open`/`target="_blank"`) é bloqueada
dentro do app e redirecionada pro navegador padrão via `shell.openExternal`.

**`preload.js`**: expõe só `window.desktopApp = { isDesktop, version, apiBaseUrl }` via
`contextBridge`. Um único canal IPC explícito e síncrono (`desktop-app:config`) — nada de
invoke/handle genérico.

Como o Angular usa paths relativos (`/api/...`) que não resolvem contra `file://`, os services HTTP
(`frontend/src/app/*/data-access/*.service.ts`) prefixam o path com `apiBase()`
(`frontend/src/app/shared/desktop-app.ts`), que lê, em ordem: `window.desktopApp?.apiBaseUrl`
(dentro do Electron) → `environment.apiUrl` (build web, só se o frontend for hospedado separado do
backend) → vazio (path relativo — caso comum, `proxy.conf.json` em dev ou mesma origem via
`nginx.conf` em produção web).

**Roteamento**: `AppModule` usa `HashLocationStrategy` (não `environment.ts`/`app.config.ts` —
projeto é module-based, sem `provideRouter`). Hoje o app não usa `RouterModule` de fato (abas trocam
por `*ngIf`, não rota), então isso não muda comportamento nenhum agora — mas é pré-requisito pra
qualquer rota futura funcionar sob `file://` (`PathLocationStrategy`, o padrão, depende de path do
servidor e quebra ali).

**`environment.ts`/`environment.production.ts`**: existem só pro build **web**
(`fileReplacements` no `angular.json`, configuração `production`). Não são o mecanismo do desktop —
`environment.apiUrl` é decidido em **build-time** do Angular (uma vez, na CI), enquanto
`window.desktopApp.apiBaseUrl` é decidido em **runtime**, no empacotamento do Electron (`desktop/config.json`,
escrito depois do Angular já compilado). É por isso que dá pra buildar o Angular **uma vez** e
reempacotar pro desktop com URLs de API diferentes sem rebuild — se fosse via `environment.ts`, cada
URL diferente exigiria recompilar o Angular inteiro.

**CSP**: `frontend/src/index.html` tem `connect-src 'self'` (cobre o deploy web, mesma origem via
nginx). No build desktop, o step "Liberar a origem da API no CSP" do workflow faz `sed` em
`desktop/app/index.html` depois de copiar o `dist/`, acrescentando a origem real do backend — sob
`file://`, `'self'` vira origem `null` e não cobre domínio remoto nenhum.

**CORS no Nest** (`backend/src/main.ts`): trocado de `origin: true` (reflete qualquer origem) por uma
allowlist explícita (`CORS_ALLOWED_ORIGINS`, csv) + liberação incondicional pra `Origin: null` — é o
que o Electron manda sob `file://`, não dá pra restringir por domínio nesse caso (qualquer conteúdo
`file://`/sandboxed manda `null`, não só este app). **Sem `credentials: true`**: o app usa
`Authorization: Bearer <token>` em `localStorage` (já era assim desde a autenticação, ver seção
acima), não cookie — de propósito. Cookie com `Origin: null` é armadilha: `SameSite=Strict/Lax` não
tem como decidir "mesmo site" sem origem real pra comparar, e `Access-Control-Allow-Origin: null` +
`Access-Control-Allow-Credentials: true` juntos são um padrão inseguro que navegador nenhum deveria
aceitar (qualquer `file://`/iframe sandboxed herdaria a sessão). Token em `localStorage` lido pelo
`AuthInterceptor` não depende de origem nenhuma pra funcionar — é por isso que já era a escolha certa
antes mesmo do wrapper desktop existir.

**Auto-update** (`electron-updater` + `electron-log`): só roda se `app.isPackaged` (em `npm start`
não tem `app-update.yml`/instalador pra checar contra, pularia com erro). `checkForUpdatesAndNotify()`
dispara em `app.whenReady()`; em `update-downloaded` mostra `dialog.showMessageBox` perguntando se
quer reiniciar — se sim, `quitAndInstall()`. Log de tudo (`update-available`, `download-progress`,
`error`) via `electron-log`. Feed de update é GitHub Releases (`build.publish` em
`desktop/package.json`, aponta pra `devarya00/conciliacao-web` — troque se o repo mudar de lugar);
`npm run dist` builda com `--publish never` (não publica sozinho, só gera `latest.yml` — o workflow
sobe esse arquivo junto do `.exe` na release, é o feed que o `electron-updater` lê pra saber se tem
versão nova).

**Sem certificado de assinatura de código** (`verifyUpdateCodeSignature: false`, `// TODO` no
`main.js`): sem isso o Windows vai mostrar aviso de "editora desconhecida" no instalador, e o
auto-update funciona mas sem a camada extra de verificação de assinatura do pacote atualizado — só
a integridade do `latest.yml` (hash) é checada. Trocar por `true` (ou remover, `true` é o padrão)
assim que tiver certificado.

Testar localmente (Arch ou qualquer SO com Electron instalado, sem gerar instalador):
```bash
cd frontend && npm run build -- --configuration development --base-href ./
rm -rf ../desktop/app && mkdir ../desktop/app && cp -r dist/dashboard-frontend/. ../desktop/app/
cd ../desktop
npm install
DASHBOARD_API_URL=http://localhost:3001 npm start
```

### Versão — fonte única de verdade

`desktop/package.json` manda: é a versão que vira número do instalador Electron, feed do
`electron-updater` (`latest.yml`) e `window.desktopApp.version` exposto pro Angular via preload.
`frontend/package.json` e `backend/package.json` são espelho — não têm efeito em runtime nenhum
(ninguém lê a versão deles em lugar algum), mas ficam sincronizados por rastreabilidade: ao investigar
um bug reportado numa versão do desktop, o commit daquela tag tem os três `package.json` no mesmo
número, então dá pra saber exatamente qual `frontend`/`backend` foi empacotado ali. **Nunca edite a
versão em só um dos três à mão** — usa o script abaixo, que sincroniza os três juntos.

### Cortar um release

```bash
./scripts/release.sh patch   # ou: minor | major | 1.2.3 (versão explícita)
```

O script: bumpa `desktop/package.json` (fonte da verdade), espelha o mesmo número em
`frontend/package.json` e `backend/package.json`, atualiza os três `package-lock.json`, commita
(`chore: release vX.Y.Z`) e cria a tag `vX.Y.Z` — tudo **local**, não empurra nada sozinho. Recusa
rodar com árvore de trabalho suja (commit ou stash antes). Pra disparar o build/publish de verdade:

```bash
git push && git push origin vX.Y.Z
```

O push da tag dispara `.github/workflows/release.yml` no GitHub Actions: builda o Angular, empacota
o instalador Windows e publica como release do GitHub (`.exe` + `latest.yml`), automático — não
precisa mexer em nada manualmente depois do `git push`.

### O que o usuário final vê ao atualizar

Instala uma vez (baixa `Dashboard Rezende-Setup-x64.exe` da release, roda o instalador NSIS —
escolhe pasta, não é one-click). Dali em diante, **sem ação nenhuma do usuário**: toda vez que abre
o app, ele confere sozinho contra o GitHub Releases (`checkForUpdatesAndNotify`); se tiver versão
nova, baixa em segundo plano (sem travar o uso) e, quando termina, aparece um diálogo perguntando se
quer reiniciar agora ou depois — clicando "Reiniciar agora" o app fecha e reabre já na versão nova
(`quitAndInstall`); "Depois" adia pra próxima abertura. Sem certificado de assinatura ainda, o
Windows/SmartScreen provavelmente vai mostrar aviso de "editora desconhecida" no instalador inicial
(não no auto-update em si, que já roda sem prompt do Windows).

## Regras de negócio implementadas

- `status_class`: `Ent.*` → entregue; `Pendente`/`Atrasada!`/`Pend. justificada` → pendente;
  `Dispensada` → dispensada; demais → outro.
- `is_reinf`: `obrigacao ILIKE '%reinf%'`.
- Data mestre do filtro: `COALESCE(data_entrega, prazo_tecnico)`.
- `nome_key`: primeiro token do nome em maiúsculas — chave de merge Onvio ↔ Workmonitor.
- Ranking por funcionário vem de `fact_produtividade` (Onvio) + `fact_performance` (Workmonitor) via
  `nome_key`, nunca do S3D (que só traz rótulo de departamento em "Responsável entrega").
- Colaborador sem par no Workmonitor aparece com barra cinza no ranking (sem score).
