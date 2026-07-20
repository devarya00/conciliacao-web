-- responsaveis no longer active (left the company), per stakeholder review.
-- Rows are never deleted - active_employee=0 just excludes them from
-- "current" rankings while keeping their historical counts queryable.
-- Re-apply after any fresh `ingest.py` run (it drops/recreates the tables).

UPDATE responsaveis SET active_employee = 0
WHERE nome_raw IN (
  'Vitor Rezende',
  'Isadora Estagiaria',
  'Dominique Dp',
  'Dep. Fiscal e Contábil.5',
  'Ana Ruth de Sena Nunes'
);
