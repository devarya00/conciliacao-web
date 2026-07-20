-- Suspected data issues flagged for stakeholder review. Rows are never
-- altered or dropped - flag_revisao just marks them for a human to confirm.
-- Keyed on natural columns (not id) so this stays valid across re-ingests.
-- Re-apply after any fresh `ingest.py` run (it drops/recreates the tables).

-- Only competencia outlier that isn't explained by a legitimately old
-- reference date (e.g. FICHA DE REGISTRO DE EMPREGADO admission dates,
-- which genuinely run back to the 1980s-2010s). PERDCOMP has no reason to
-- reference a 2074 competencia; almost certainly a typo, possibly for 05/2024.
UPDATE obrigacoes
SET flag_revisao = 'competencia informada como 05/2074 - provavel erro de digitacao (confirmar se deveria ser 05/2024)'
WHERE obrigacao_tarefa = 'PERDCOMP - FISCAL'
  AND emp_id = 389
  AND competencia_ano = 2074
  AND competencia_mes = 5;
