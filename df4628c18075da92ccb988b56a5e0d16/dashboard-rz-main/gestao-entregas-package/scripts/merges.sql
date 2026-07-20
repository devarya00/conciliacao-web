-- responsaveis name-collision decisions from the stakeholder review.
-- Re-apply after any fresh `ingest.py` run (it drops/recreates the tables).
-- Keyed by nome_raw rather than id, since autoincrement ids depend on
-- CSV row order and aren't guaranteed stable across re-ingests.
--
-- Rows are never deleted - canonical_id just tells v_obrigacoes which name
-- to report under, while raw per-name counts stay queryable for auditing.

-- Lauriane also appears under the department label "Sucesso do Cliente";
-- collide onto her real name.
UPDATE responsaveis
SET canonical_id = (SELECT id FROM responsaveis WHERE nome_raw = 'Lauriane')
WHERE nome_raw = 'Sucesso do Cliente';
