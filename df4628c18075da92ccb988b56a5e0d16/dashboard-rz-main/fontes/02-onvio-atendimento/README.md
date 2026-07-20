# 02 · Onvio — Atendimento / Produtividade (`estatisticas-funcionários`)

**Sistema:** Onvio — "**sistema de gestão de atendimento**". Esta é a **primeira das duas planilhas do
Onvio** que o Weslem citou ("de atendimento, quantidade e etc"). A segunda é a satisfação (`03`).
**Papel no produto:** saída **3** (gráfico de atendimento) e saída **4** (produtividade); dá a
**contagem de atendimentos** que vira pontos na premiação (saída 2).

## Arquivos aqui

22 CSVs, **um por dia útil** de junho/2026. A data está **no nome do arquivo**
(`estatisticas-funcionários_DD-MM-AAAA_DD-MM-AAAA.csv`) — o conteúdo não repete a data.

## Formato

CSV `;`, UTF-8 (com BOM). Uma linha por colaborador, agregando o dia.

| Coluna | Exemplo | Observação |
|--------|---------|------------|
| `Nome` | `Danielly - Pessoal` | tem sufixo de depto; `nome_key` = 1º token (`DANIELLY`) |
| `Tempo médio` | `00:46:53` | `HH:MM:SS` por tarefa → converter p/ segundos |
| `Abertos` | `0` | tarefas em aberto no fim do dia |
| `Iniciados` | `10` | iniciadas no dia |
| `Concluídos` | `10` | **concluídas no dia** = contagem de atendimento |
| `Desconsiderados` | `0` | descartadas |
| `Satisfação` | `0` | quase sempre 0 aqui; a satisfação real vem de `03` |

Exemplo real: `Danielly - Pessoal;00:46:53;0;10;10;0;0`

## Ligações

- **Contagem de atendimento** (`Concluídos`) × **3 pontos** entra na premiação (×5 quando o mesmo
  atendimento tem nota "muito satisfeito" em `03`).
- **Colaborador:** `nome_key` cruza com satisfação (`03`), tarefas (`01`) e workmonitor (`04`).
- **No código:** `../../backend/src/dashboard/ingestao/parsers/onvio-produtividade.parser.ts`
  → tabela `fact_produtividade`. Roteia por nome contendo `estatisticas-funcionarios`.
  A data vem do nome do arquivo.
