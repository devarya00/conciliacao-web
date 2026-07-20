# 05 · Work monitor — Analítico de Jornada / Ponto (`export_analitico`)

**Sistema:** família Work monitor — export **analítico** (jornada real vs. cadastrada, entrada/saída).
Complementa o resumo de performance (`04`). *Obs.: o Weslem não nomeou este arquivo explicitamente no
chat; a inferência vem das colunas (jornada/entrada/saída), que são vocabulário do Work monitor.*
**Papel no produto:** insumo fino da saída **4** (produtividade / assiduidade — jornada aferida vs. esperada).

## Arquivos aqui

`export_analitico.csv` — 135 linhas (várias datas/colaboradores no mesmo arquivo, diferente de `04`).

## Formato

CSV `;`, UTF-8. Uma linha por colaborador **por dia**.

| Coluna | Exemplo | Observação |
|--------|---------|------------|
| `id` | `11` | |
| `Colaborador` | `DANIELLY` | já em maiúsculas → `nome_key` |
| `Data` | `16/06/2026` | `dd/mm/yyyy` (aqui a data está **na linha**, não no nome) |
| `Atividades(seg)` | `378` | tempo em atividade (s) |
| `Jornada aferida (seg)` | `6700` | jornada medida (s) |
| `Jornada cadastrada(seg)` | `32400` | jornada esperada/contratada (s) |
| `Entrada` | `14:18:26` | 1º registro |
| `Saida` | `16:10:06` | último registro |

Exemplo real: `11;DANIELLY;16/06/2026;378;6700;32400;14:18:26;16:10:06`

## Ligações

- **Colaborador:** `Colaborador` → `nome_key` cruza com `04` e demais fontes.
- **No código:** origem `workmonitor_analitico` (hint `export_analitico`).
  Parser `../../backend/src/dashboard/ingestao/parsers/workmonitor-analitico.parser.ts`
  → tabela **`fact_jornada`** (migração `011_arquivo_hash_e_jornada.sql`). Agrega por
  colaborador+dia (soma atividades/aferida, min entrada, max saída). Chave de upsert
  `(colaborador_id, data)`.
- ⚠️ Origem inferida (o Weslem não nomeou este relatório no chat). **Confirmar se é para usar de fato**
  antes de plugar na saída de produtividade.
