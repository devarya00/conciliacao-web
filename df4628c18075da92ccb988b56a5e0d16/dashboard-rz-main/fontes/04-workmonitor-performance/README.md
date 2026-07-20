# 04 · Work monitor — Performance diária (`Workmonitor_performance`)

**Sistema:** Work monitor (Genia) — o que o Weslem chama de "**controle de produtividade**"
(monitoramento de tela). **Papel no produto:** saída **4** (gráfico de produtividade); é o `score_genia`
que ele quer bater com o gráfico-exemplo que mandou.

## Arquivos aqui

41 CSVs. A maioria é **por dia** (`..._2026-06-09_a_2026-06-09.csv`); há também alguns de **período**
(`..._2026-06-15_a_2026-06-26.csv`). **Para o produto, usar os por dia** (o Weslem confirmou que o
gráfico-exemplo é diário). Cobertura: dias úteis de 01–30/jun/2026 (sem 07/14/21/28 — não são úteis).

## Formato

CSV `;`, UTF-8. Uma linha por colaborador, agregando o dia. Tempos em **segundos**; `score_genia` usa
**vírgula decimal**.

| Coluna | Exemplo | Observação |
|--------|---------|------------|
| `id`, `id_aux_1`, `id_aux_2` | `1`, ``, `` | id interno; auxiliares vazios |
| `Nome` | `FERNANDA` | `nome_key` de junção |
| `dias_com_atividade` | `1` | |
| `jornada_esperada_segs` | `32400` | 8–9 h em segundos |
| `total_atividades_segs` | `31076` | tempo total em qualquer atividade |
| `total_produtivo_segs` | `25852` | produtivo |
| `total_neutro_segs` | `1` | neutro |
| `total_improdutivo_segs` | `5223` | improdutivo |
| `total_ocio_segs` | `1324` | ocioso |
| `alertas_comportamentais` / `alertas_bloqueios` / `alertas_acesos` | `0` / `0` / `45` | somados = total de alertas |
| `score_genia` | `107,75` | score proprietário (vírgula decimal) |

Exemplo real: `1;;;FERNANDA;1;32400;31076;25852;1;5223;1324;0;0;45;107,75`

## Ligações

- **Colaborador:** `Nome` → `nome_key` cruza com Onvio (`02`/`03`) e Acessórias (`01`).
- **Complemento:** o analítico de jornada/ponto está em `05` (`export_analitico`).
- **No código:** `../../backend/src/dashboard/ingestao/parsers/workmonitor.parser.ts`
  → tabela `fact_performance`. Roteia por nome contendo `workmonitor`. **Exige data de dia único** no
  nome do arquivo (lança erro se o intervalo abrange vários dias — por isso preferir os "por dia").
- **Não entra na premiação** — Workmonitor é produtividade/comportamento, não pontuação de prêmio.
