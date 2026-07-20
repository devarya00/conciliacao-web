# 03 · Onvio — Satisfação (`estatisticas-satisfação`)

**Sistema:** Onvio — **segunda planilha do Onvio** ("outra de quantidade de satisfação").
**Papel no produto:** parte da saída **3** (gráfico de atendimento) e, sobretudo, o **multiplicador da
premiação**: um atendimento "muito satisfeito" vale **5 pontos** em vez de 3.

## Arquivos aqui

25 CSVs, **um por dia** de junho/2026 (data no nome do arquivo). Volume pequeno (uma linha por
atendimento avaliado — de ~0 a algumas dezenas por dia).

## Formato

CSV `;`, UTF-8 (com BOM). **Uma linha por atendimento avaliado** (não é agregado por pessoa).

| Coluna | Exemplo | Observação |
|--------|---------|------------|
| `Clientes` | `BPO ASSERTIVO ASSESSORIA DE FINANCAS LTDA,REZENDE...` | pode listar mais de um |
| `Contato` | `ASSESSORIA FINANCEIRA - ` | pessoa de contato |
| `Atendido por` | `Maria Beatriz - BPO` | **colaborador** — `nome_key` = `MARIA` (ver nota) |
| `Data` | `2026-06-09T11:29:06.158Z` | ISO 8601 com hora |
| `Nota` | `Muito satisfeito` | `Muito satisfeito` \| `Satisfeito` \| `Neutro` \| `Insatisfeito` \| `Muito insatisfeito` |

Exemplo real: `...;ASSESSORIA FINANCEIRA - ;Maria Beatriz - BPO;2026-06-09T11:29:06.158Z;Muito satisfeito`

## Regra

- Mapeamento nota → escala: Muito satisfeito=5, Satisfeito=4, Neutro=3, Insatisfeito=2, Muito insatisfeito=1.
- **Na premiação, só "muito satisfeito" muda o valor** do atendimento (3 → 5 pontos). As demais notas
  mantêm 3.
- Chave de contagem por colaborador = `Atendido por` → `nome_key`. (Cuidado com nomes compostos como
  "Maria Beatriz": o 1º token pode não desambiguar — casar contra os nomes de `02`/`04` se preciso.)

## Ligações

- **No código:** `../../backend/src/dashboard/ingestao/parsers/onvio-satisfacao.parser.ts`.
  Roteia por nome contendo `estatisticas-satisfa`. Retorna **todas** as linhas (não deduplica), para
  permitir contar "muito satisfeito" e aplicar a satisfação por colaborador.
