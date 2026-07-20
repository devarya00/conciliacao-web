-- Guarda TODAS as linhas do S3D em vez de colapsar na chave natural: a mesma
-- obrigacao/competencia aparece varias vezes tanto por reenvio (Atrasada! ->
-- Ent.) quanto por execucao diaria de tarefa recorrente. `ocorrencia` e o
-- indice (1..N) de cada repeticao na ordem do arquivo; a deduplicacao vira uma
-- escolha de leitura (v_entrega_dedup), nao mais uma perda na ingestao.

ALTER TABLE fact_entrega
  DROP CONSTRAINT IF EXISTS fact_entrega_emp_id_obrigacao_competencia_key;

ALTER TABLE fact_entrega
  ADD COLUMN IF NOT EXISTS ocorrencia int NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_entrega_chave
  ON fact_entrega (emp_id, obrigacao, competencia, ocorrencia);

-- Leitura deduplicada: ultima ocorrencia da chave natural vence (mesma regra
-- "ultima linha do arquivo vence" que antes era aplicada na ingestao).
CREATE OR REPLACE VIEW v_entrega_dedup AS
SELECT DISTINCT ON (emp_id, obrigacao, competencia) *
FROM fact_entrega
ORDER BY emp_id, obrigacao, competencia, ocorrencia DESC;
