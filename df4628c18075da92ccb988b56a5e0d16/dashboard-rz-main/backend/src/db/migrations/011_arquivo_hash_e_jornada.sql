-- Deduplicacao por CONTEUDO (hash SHA-256) + nova fonte de jornada (export_analitico).
--
-- Ate aqui a idempotencia era so por (nome_original, origem). Isso nao pega o
-- mesmo arquivo reenviado com nome diferente (ex.: "... (1).csv", re-download do
-- Teams). Passa a guardar o hash do conteudo: mesmo bytes = mesmo arquivo,
-- independente do nome. O índice único é parcial (só linhas com hash) para não
-- brigar com as linhas antigas (hash NULL) já existentes.

ALTER TABLE arquivo_ingestao
  ADD COLUMN IF NOT EXISTS conteudo_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_arquivo_conteudo_hash
  ON arquivo_ingestao (conteudo_hash)
  WHERE conteudo_hash IS NOT NULL;

-- Jornada / ponto (Workmonitor · export_analitico): entrada/saida e jornada
-- aferida x cadastrada por colaborador/dia. Grao proprio (uma linha por
-- colaborador/dia), CASCADE no arquivo como as demais facts.
CREATE TABLE IF NOT EXISTS fact_jornada (
  id                    bigserial PRIMARY KEY,
  colaborador_id        bigint REFERENCES dim_colaborador(id),
  data                  date NOT NULL,
  atividades_s          int DEFAULT 0,   -- tempo em atividade (seg)
  jornada_aferida_s     int DEFAULT 0,   -- jornada medida (seg)
  jornada_cadastrada_s  int DEFAULT 0,   -- jornada contratada/esperada (seg)
  entrada               time,            -- primeiro registro do dia
  saida                 time,            -- ultimo registro do dia
  arquivo_id            bigint REFERENCES arquivo_ingestao(id) ON DELETE CASCADE,
  UNIQUE (colaborador_id, data)
);

CREATE INDEX IF NOT EXISTS ix_jornada_data ON fact_jornada (data);
CREATE INDEX IF NOT EXISTS ix_jornada_arquivo ON fact_jornada (arquivo_id);
