-- Unique "responsavel" names with usage counts, for stakeholder review /
-- name-collision (same person entered under multiple name strings).
-- Add a "mesma_pessoa_que" column downstream and fill in canonical_id once
-- decided (see responsaveis.canonical_id in schema.sql).

SELECT
  r.id,
  r.nome_raw,
  COUNT(DISTINCT CASE WHEN o.responsavel_prazo_id = r.id THEN o.id END)   AS n_como_resp_prazo,
  COUNT(DISTINCT CASE WHEN o.responsavel_entrega_id = r.id THEN o.id END) AS n_como_resp_entrega,
  COUNT(DISTINCT o.id)                                                    AS n_total,
  GROUP_CONCAT(DISTINCT o.departamento)                                   AS departamentos
FROM responsaveis r
LEFT JOIN obrigacoes o
  ON o.responsavel_prazo_id = r.id OR o.responsavel_entrega_id = r.id
GROUP BY r.id
ORDER BY n_total DESC;
