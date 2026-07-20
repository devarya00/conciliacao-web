# 01 · Acessórias — Tarefas / Obrigações (`S3D_gestao_de_entregas`)

**Sistema:** Acessórias — o que o Weslem chama de "**sistema de gestão de tarefas**".
**Papel no produto:** é a espinha dorsal. Alimenta a saída **1** (tarefas entregues/pendentes/justificadas)
e, junto com a Legenda de pontos (`06`), a saída **2** (premiação por tarefa).

## Arquivos aqui

| Arquivo | Data | Linhas | Formato do responsável |
|---------|------|--------|------------------------|
| `S3D_gestao_de_entregas_20260706151046_17155.csv` | 06/07 | 125.515 | **Departamento** (formato antigo) |
| `S3D_gestao_de_entregas_20260716103456_17155.csv` | 16/07 | 81.576 | **Nome do colaborador** (formato NOVO — autoritativo) |

> O Weslem regerou o relatório trocando departamento por nome de colaborador para permitir cruzar
> tarefas × atendimento × produtividade pela pessoa. **Use o de 16/07.** O de 06/07 fica como histórico.

## Formato

CSV separado por `;`, UTF-8, cabeçalho na 1ª linha.

| Coluna | Exemplo | Observação |
|--------|---------|------------|
| `Obrigação / Tarefa` | `DASN - SIMEI - Dec. Anual Simples Nacional para o MEI` | casa com `ID.TAREFA` da Legenda (`06`) |
| `Tipo` | `Obrigação` \| `Tarefa` | |
| `Empresa` | `65.598.893 GESSIELI BARBOSA SANTOS MATTOS KRAMM` | razão social crua |
| `EmpID` | `472` | id estável da empresa |
| `CNPJ` | `65.598.893/0001-64` | |
| `Cidade` / `Estado` | `RONDONOPOLIS` / `MT` | |
| `Prazo legal` / `Prazo Técnico` | `29/05/2026` / `24/05/2026` | `dd/mm/yyyy` |
| `Data da entrega` | vazio ou `16/06/2026` | vazio = não entregue |
| `Status` | `Dispensada`, `Ent. PzTéc.`, `Ent. atrasada`, `Atrasada!`, `Pendente`, `Pend. justificada` | ver classificação |
| `Departamento` | `Fiscal`, `Pessoal`, `Contabil` | |
| `Responsável prazo` | `Elaine  Dp Fiscal-contabil` (novo) / `depart.fiscal.e.Contábil` (antigo) | |
| `Responsável entrega` | `Isadora - Dp` ou vazio | |
| `Competência` | `12/2025`, `04/2026` | mês de referência |
| `Protocolo` | `OK` ou vazio | |

## Classificação de status (regra do produto)

- **Entregue:** começa com `Ent.` (`Ent. PzTéc.`, `Ent. atrasada`, …)
- **Pendente:** `Pendente`, `Atrasada!`, `Pend. justificada`
- **Justificada:** `Pend. justificada` (subcaso de pendente que o Weslem quer ver separado)
- **Dispensada:** `Dispensada` (não conta)
- Data-mestra para filtro/período: `COALESCE(Data da entrega, Prazo Técnico)`.

## Ligações

- **Pontos:** `Obrigação / Tarefa` → `ID.TAREFA` na **Legenda de Tarefas** (`06`) → `PONTOS`.
- **Colaborador:** `nome_key` (1º token do responsável, maiúsculas) → junção com Onvio (`02`/`03`) e Workmonitor (`04`).
- **No código:** `../../backend/src/dashboard/ingestao/parsers/s3d.parser.ts` → tabela `fact_entrega`.
  Roteia por nome contendo `s3d`. Sinaliza obrigações ReinF via `obrigacao ILIKE '%reinf%'`.

⚠️ Arquivos grandes (~17 MB). Contêm dados de clientes reais — sensível.
