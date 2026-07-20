# 07 · Controle de Premiação — planilha legada do Weslem (`CONTROLE DE PRODUT. ATENDI.xlsx`)

**O que é:** a planilha que o **Weslem fazia na mão**, com as **fórmulas do prêmio**. Não é uma fonte de
dado nova — é a **especificação viva de como a premiação era calculada**. Serve de **oráculo de teste**:
o número que a plataforma produzir tem que bater com esta planilha.
> WES: "aqui tem planilha e controle que eu fazia, e fórmulas... lá eu preenchia manual o número de avaliação."

## Arquivos

`CONTROLE DE PRODUT. ATENDI.xlsx` (+ cópia `(1)`). Duas abas:

### Aba `DADOS` (867 linhas) — o cálculo por colaborador/mês

| Coluna | Exemplo | Observação |
|--------|---------|------------|
| `Nome` | `DEP. PESSOAL 2` | rótulo antigo (departamento) |
| `EQUIPE` | `DANIELLY` | **colaborador** |
| `Tempo médio` | `0.00537…` | fração de dia (Excel) |
| `Abertos` / `Iniciados` / `Concluídos` / `Desconsiderados` | `0/275/275/75` | vindos do Onvio (`02`) |
| `satisfação` | `100` | % satisfação |
| `muito satisf.` | `10` | nº de "muito satisfeito" (vira +2 pts/atend.) |
| `TOTAL PONTOS` | `845` | pontos tarefas + atendimentos |
| `PREMIO` | `152.1` | **= TOTAL PONTOS × valor do ponto** |
| `MES` / `ANO` | `10` / `2023` | competência |

### Aba `RESUMO` — tabela dinâmica (pivot) por mês

`Soma de TOTAL PONTOS`, `Soma de PREMIO`, `Soma de muito satisf.`, `Soma de Concluídos`, `Soma de Abertos`
por colaborador. Filtros `MES`/`ANO`/`satisfação`.

## O que esta planilha CONFIRMA (regra de negócio)

- **PRÊMIO = TOTAL PONTOS × valor por ponto.** Exemplos reais:
  - dez/2025: Maria Beatriz → 264 pontos → PREMIO **47,52** ⇒ **R$ 0,18/ponto** (valor atual).
  - 2023: Fernanda → 941 pontos → PREMIO 94,10 ⇒ R$ 0,10/ponto (valor da época — mudou no tempo).
- `TOTAL PONTOS` soma **tarefas** (pontos por dificuldade, `06`) **+ atendimentos** (3, ou 5 se muito satisfeito).
- Confirma que atendimento e tarefa são contados separados e só somam no total.

## Ligações

- Não tem parser e **não deve ser ingerida** — é referência/QA. O cálculo equivalente é responsabilidade
  do backend a partir de `01`+`02`+`03`+`06`.
- Use-a para validar a saída **2** (premiação) do dashboard antes de subir para produção.
