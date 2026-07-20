-- Schema for "gestao de entregas" (tax/compliance obligation delivery tracking) ingest.
-- Source: S3D export, one row per obligation/task per company per competencia (reference month).

DROP VIEW IF EXISTS v_obrigacoes;
DROP TABLE IF EXISTS obrigacoes;
DROP TABLE IF EXISTS responsaveis;
DROP TABLE IF EXISTS empresas;

CREATE TABLE empresas (
  emp_id INTEGER PRIMARY KEY,   -- "EmpID" from the CSV, stable per company
  cnpj   TEXT NOT NULL,
  nome   TEXT NOT NULL,
  cidade TEXT,
  estado TEXT
);

-- One row per distinct name string as it appears in the CSV ("Responsável prazo" /
-- "Responsável entrega"). The same human may show up under more than one nome_raw
-- (e.g. typos, name changes). canonical_id lets that be resolved later without
-- rewriting obrigacoes: point the duplicate row at the row that should "win".
CREATE TABLE responsaveis (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_raw        TEXT NOT NULL UNIQUE,
  canonical_id    INTEGER REFERENCES responsaveis(id),
  active_employee INTEGER NOT NULL DEFAULT 1  -- 0 = no longer works there; kept for historical counts, excluded from active rankings
);

CREATE TABLE obrigacoes (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  obrigacao_tarefa       TEXT NOT NULL,
  tipo                   TEXT NOT NULL CHECK (tipo IN ('Obrigação', 'Tarefa')),
  emp_id                 INTEGER NOT NULL REFERENCES empresas(emp_id),
  prazo_legal            TEXT NOT NULL,   -- ISO date YYYY-MM-DD
  prazo_tecnico          TEXT NOT NULL,   -- ISO date YYYY-MM-DD
  data_entrega           TEXT,            -- ISO date YYYY-MM-DD, NULL if not yet delivered
  status                 TEXT NOT NULL,
  departamento           TEXT,
  responsavel_prazo_id   INTEGER REFERENCES responsaveis(id),
  responsavel_entrega_id INTEGER REFERENCES responsaveis(id),
  competencia_ano        INTEGER NOT NULL,
  competencia_mes        INTEGER NOT NULL,
  protocolo              TEXT,
  flag_revisao           TEXT             -- non-NULL = suspected data issue flagged for stakeholder review (e.g. probable typo); row is never altered or dropped
);

CREATE INDEX idx_obrigacoes_emp_id      ON obrigacoes(emp_id);
CREATE INDEX idx_obrigacoes_status      ON obrigacoes(status);
CREATE INDEX idx_obrigacoes_competencia ON obrigacoes(competencia_ano, competencia_mes);
CREATE INDEX idx_obrigacoes_resp_prazo  ON obrigacoes(responsavel_prazo_id);
CREATE INDEX idx_obrigacoes_resp_entrega ON obrigacoes(responsavel_entrega_id);

-- Resolves each responsavel through canonical_id, so queries against this view
-- automatically merge duplicate name entries once they're linked up.
CREATE VIEW v_obrigacoes AS
SELECT
  o.id,
  o.obrigacao_tarefa,
  o.tipo,
  e.emp_id,
  e.nome     AS empresa_nome,
  e.cnpj,
  e.cidade,
  e.estado,
  o.prazo_legal,
  o.prazo_tecnico,
  o.data_entrega,
  o.status,
  o.departamento,
  COALESCE(rp_c.nome_raw, rp.nome_raw) AS responsavel_prazo,
  COALESCE(rp_c.active_employee, rp.active_employee) AS responsavel_prazo_ativo,
  COALESCE(re_c.nome_raw, re.nome_raw) AS responsavel_entrega,
  COALESCE(re_c.active_employee, re.active_employee) AS responsavel_entrega_ativo,
  o.competencia_ano,
  o.competencia_mes,
  printf('%02d/%04d', o.competencia_mes, o.competencia_ano) AS competencia,
  o.protocolo,
  o.flag_revisao
FROM obrigacoes o
JOIN empresas e ON e.emp_id = o.emp_id
LEFT JOIN responsaveis rp   ON rp.id = o.responsavel_prazo_id
LEFT JOIN responsaveis rp_c ON rp_c.id = rp.canonical_id
LEFT JOIN responsaveis re   ON re.id = o.responsavel_entrega_id
LEFT JOIN responsaveis re_c ON re_c.id = re.canonical_id;
