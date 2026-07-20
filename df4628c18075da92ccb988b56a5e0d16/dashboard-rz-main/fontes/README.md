# `fontes/` — as planilhas que alimentam o dashboard

Fontes brutas exportadas dos sistemas da Rezende Contabilidade e compartilhadas pelo Weslem no Teams
(jun–jul/2026). Cada subpasta = **um tipo de fonte**, com os arquivos originais + um `README.md`
explicando o que é, de onde vem, coluna a coluna, e **como se liga às ideias do Weslem**.

Contexto do pedido (o "brief" do Weslem, na linguagem dele): ver [`CONVERSA-WESLEM.md`](./CONVERSA-WESLEM.md).

## As 4 saídas que o Weslem quer (o produto)

| # | Saída pedida | Fontes que alimentam |
|---|--------------|----------------------|
| 1 | Tarefas **entregues / pendentes / justificadas** | Acessórias (`01`) |
| 2 | Tarefas entregues com **cálculo de premiação** | Acessórias (`01`) + Legenda de pontos (`06`) + Onvio satisfação (`03`) |
| 3 | **Gráfico de atendimento** | Onvio atendimento (`02`) + Onvio satisfação (`03`) |
| 4 | **Gráfico de produtividade** | Workmonitor (`04`, `05`) + Onvio atendimento (`02`) |

> Tudo é alimentado **por planilha (Excel/CSV)**. API "fica para depois" (fala do Weslem).

## Mapa das fontes

| Pasta | Sistema (como o Weslem chama) | O que é | Formato | Qtde |
|-------|------------------------------|---------|---------|------|
| [`01-acessorias-tarefas`](./01-acessorias-tarefas/) | **Acessórias** — "gestão de tarefas" | Obrigações/tarefas por empresa: prazo, status, responsável, competência | CSV `;` | 2 |
| [`02-onvio-atendimento`](./02-onvio-atendimento/) | **Onvio** — "gestão de atendimento" | Produtividade diária por colaborador (iniciados/concluídos/tempo médio) | CSV `;` | 22 |
| [`03-onvio-satisfacao`](./03-onvio-satisfacao/) | **Onvio** — satisfação | Uma linha por atendimento avaliado (cliente, atendente, nota) | CSV `;` | 25 |
| [`04-workmonitor-performance`](./04-workmonitor-performance/) | **Work monitor** — "controle de produtividade" | Resumo diário por colaborador: produtivo/ocioso/score | CSV `;` | 41 |
| [`05-workmonitor-analitico-jornada`](./05-workmonitor-analitico-jornada/) | **Work monitor** — analítico | Jornada/ponto por colaborador (entrada, saída, aferida × cadastrada) | CSV `;` | 1 |
| [`06-legenda-tarefas-pontos`](./06-legenda-tarefas-pontos/) | **Legenda de Tarefas** | Tabela de referência: pontos por tarefa (dificuldade) | XLSX | 1 |
| [`07-controle-premiacao-legado`](./07-controle-premiacao-legado/) | Controle manual do Weslem | Planilha legada com as **fórmulas do prêmio** (pontos × R$0,18) | XLSX | 2 |

## A regra de negócio central — premiação

```
pontos_tarefa      = soma dos PONTOS (Legenda 06) das tarefas ENTREGUES pelo colaborador (Acessórias 01)
pontos_atendimento = nº de atendimentos × 3   (×5 quando a nota é "muito satisfeito")   (Onvio 02/03)
PRÊMIO (R$)        = (pontos_tarefa + pontos_atendimento) × R$ 0,18   ← valor por ponto FIXO
```

Tarefas e atendimentos são **contagens independentes**; só se somam no total de pontos.
Confirmado pela planilha legada (`07`): em dez/2025, 264 pontos → R$47,52 (= 264 × 0,18).

## Chave de junção entre fontes

**Nome do colaborador** (`nome_key` = 1º nome em maiúsculas). O Weslem migrou o relatório da Acessórias
de *departamento* para *nome de colaborador* justamente para permitir esse cruzamento — por isso o
**S3D de 16/07 já vem com nomes** e é o autoritativo; o de 06/07 (departamentos) é histórico.

## Identidade canônica de colaborador (roster revisado)

O `nome_key` (1º token) sozinho **fragmenta e funde gente errada** entre as planilhas: a mesma pessoa
aparece como "Lisa" (S3D) e "Lisamara" (Onvio/Workmonitor); "Maria" e "Maria Beatriz" viram duas;
rótulos de setor ("Dep. Fiscal", "Diretoria") entram como se fossem gente; ex-funcionários poluem o
"atual". A correção usa o **roster revisado com stakeholder** em
`../gestao-entregas-package/gestao_entregas.db` (tabela `responsaveis` + `merges.sql`/`active_flags.sql`).

No banco isso vira uma camada **não-destrutiva** sobre `dim_colaborador` (migração
`012_colaborador_canonico.sql`): colunas `canonical_id` (funde a mesma pessoa), `active_employee`
(quem saiu) e `is_pessoa` (rótulo de setor ≠ indivíduo). Definição em
`../backend/src/dashboard/ingestao/roster-canonico.ts`; aplicada por `npm run roster:apply` (idempotente,
roda automático ao fim do `ingest:bulk`). **Leia sempre pela view `v_colaborador`** — ela resolve o
`colaborador_id` cru para a identidade canônica e carrega os flags. Resultado: 39 linhas cruas → 21
pessoas (17 ativas) + 15 rótulos.

## Relação com o código já existente

O backend (`../backend/src/dashboard/ingestao/parsers/`) já tem um parser por fonte, gravando em tabelas
`fact_*`. Cada README de subpasta aponta o parser e a tabela correspondentes. Ingestão por upload
(`POST /api/dashboard/arquivos`) ou varredura de pasta; o roteamento é por **trecho do nome do arquivo**
(`s3d`, `estatisticas-funcionarios`, `estatisticas-satisfa`, `workmonitor`, `legenda`).

## Procedência

Arquivos baixados do chat do Teams em 17/07/2026 (cópia idêntica também em `~/kronos/relatorio-pdf/`).
Dados reais de colaboradores/clientes — **tratar como sensível**, não commitar em repositório público.
