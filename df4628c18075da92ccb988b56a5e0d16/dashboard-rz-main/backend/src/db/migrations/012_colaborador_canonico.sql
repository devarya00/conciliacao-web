-- Camada de identidade canonica sobre dim_colaborador, alimentada pelo roster
-- revisado com stakeholder (gestao-entregas-package/gestao_entregas.db).
--
-- Mesmo padrao do pacote SQLite: nao apaga/reescreve linha nenhuma. So marca:
--  - canonical_id: quando o nome_key (1o token) fragmentou a MESMA pessoa em
--    varias linhas (ex.: LISA vs LISAMARA), aponta a "perdedora" para a "vencedora".
--  - active_employee: quem saiu da empresa (fica no historico, sai do "atual").
--  - is_pessoa: rotulos de setor (Dep. Fiscal, Diretoria, Teste...) que nao sao
--    individuos e nao entram em ranking por pessoa.
-- Os valores sao aplicados por IngestaoService.aplicarRosterCanonico (keyed por
-- nome_key, idempotente), pos-ingestao - migration so cria a estrutura.

ALTER TABLE dim_colaborador
  ADD COLUMN IF NOT EXISTS canonical_id bigint REFERENCES dim_colaborador(id);
ALTER TABLE dim_colaborador
  ADD COLUMN IF NOT EXISTS active_employee boolean NOT NULL DEFAULT true;
ALTER TABLE dim_colaborador
  ADD COLUMN IF NOT EXISTS is_pessoa boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS ix_colaborador_canonical ON dim_colaborador (canonical_id);

-- Resolve cada colaborador_id "cru" para a identidade canonica. Reporting deve
-- juntar as facts por aqui (colaborador_id -> canonical_id) e filtrar
-- active_employee / is_pessoa conforme o caso.
CREATE OR REPLACE VIEW v_colaborador AS
SELECT
  c.id                                        AS colaborador_id,
  COALESCE(cc.id, c.id)                       AS canonical_id,
  COALESCE(cc.nome, c.nome)                   AS nome,
  COALESCE(cc.nome_key, c.nome_key)           AS nome_key,
  COALESCE(cc.active_employee, c.active_employee) AS active_employee,
  COALESCE(cc.is_pessoa, c.is_pessoa)         AS is_pessoa,
  COALESCE(cc.departamento, c.departamento)   AS departamento
FROM dim_colaborador c
LEFT JOIN dim_colaborador cc ON cc.id = c.canonical_id;
