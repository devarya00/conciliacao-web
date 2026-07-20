-- Reconciliacao de nomes divergentes entre planilhas de desempenho (ex.:
-- "Lisamara" vs "Lisa dp fiscal") contra dim_colaborador. Chave composta por
-- departamento_normalizado + alias_normalizado - nunca colapsa colaboradores
-- de departamentos diferentes, mesmo com nome/alias identico.
CREATE TABLE IF NOT EXISTS employee_alias (
  id                        bigserial PRIMARY KEY,
  colaborador_id            bigint NOT NULL REFERENCES dim_colaborador(id),
  departamento_normalizado  text NOT NULL,
  alias_normalizado         text NOT NULL,
  alias_original            text,
  criado_em                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (departamento_normalizado, alias_normalizado)
);

-- Linhas que nao bateram exato nem fuzzy (score >= 88) na ingestao ficam fora
-- de fact_performance ate um alias ser aprovado manualmente.
CREATE TABLE IF NOT EXISTS ingestion_review_queue (
  id           bigserial PRIMARY KEY,
  raw_name     text NOT NULL,
  raw_dept     text NOT NULL,
  source_file  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);

CREATE INDEX IF NOT EXISTS ix_review_queue_pendentes
  ON ingestion_review_queue (created_at) WHERE resolved_at IS NULL;
