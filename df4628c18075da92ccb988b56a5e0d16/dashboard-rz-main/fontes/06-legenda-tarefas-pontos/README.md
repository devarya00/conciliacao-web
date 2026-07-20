# 06 · Legenda de Tarefas — Pontos por dificuldade (`LEGENDA TAREFAS.xlsx`)

**O que é:** a tabela de referência que dá **quantos pontos vale cada tarefa**. Mantida pela **Fernanda**
e atualizada **só quando criam uma tarefa nova** (não é diária) — fala do Weslem.
**Papel no produto:** é o "de-para" que transforma tarefa entregue (`01`) em **pontos** para a
premiação (saída **2**).

## Arquivo

`LEGENDA TAREFAS.xlsx` — 1 aba (nome vem com o typo `LEGENDA TARFEAS`), **1.197 linhas**.

## Formato

| Coluna | Exemplo | Observação |
|--------|---------|------------|
| `ID.TAREFA` | `ADMISSÃO`, `13º SALÁRIO- INTEGRAL` | casa com `Obrigação / Tarefa` do S3D (`01`) |
| `CLASSIFICAÇÃO` | `FACIL` \| `DIFICIL` \| `COMPLEXA` | **dificuldade** da tarefa |
| `PONTOS` | `1`, `3` | pontos atribuídos |
| `DEPARTAMENTO` | `Pessoal`, `Fiscal`, `Contabil` | departamento dono |

Exemplos reais:
```
ADIANTAMENTO DE SALARIO | FACIL   | 1 | Pessoal
ADMISSÃO                | DIFICIL | 3 | Pessoal
1ª PARCELA 13º SALÁRIO  | COMPLEXA| 3 | Pessoal
```

> Nota: existem muitas variações numeradas da mesma tarefa (`ADMISSÃO`, `ADMISSÃO 10`, `ADMISSÃO 11`…),
> às vezes com pontos diferentes. Ao casar com o S3D, normalizar o nome (`obrigacao_key`) e, em duplicatas,
> a **última ocorrência vence** (comportamento do parser atual).

## Ligações

- **Junção:** `ID.TAREFA` (normalizado) ← `Obrigação / Tarefa` do S3D (`01`).
- **Uso:** soma de `PONTOS` das tarefas entregues por colaborador → parcela de tarefas do prêmio
  (a outra parcela é atendimento×3/5, de `02`/`03`).
- **No código:** `../../backend/src/dashboard/ingestao/parsers/legenda-tarefas.parser.ts`
  (migração `005_pontos_tarefas_atendimento.sql`). Roteia por nome contendo `legenda`.

## Legenda de *usuários* — descontinuada

Havia também uma "legenda de usuários" (de-para departamento→pessoa). O Weslem **descontinuou**: agora o
relatório da Acessórias já sai com nome do colaborador (S3D 16/07). Não é mais necessária.
