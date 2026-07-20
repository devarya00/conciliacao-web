-- Schema consolidado do Dashboard de Produtividade e Operacoes
-- Fontes: Acessorias (S3D_gestao_de_entregas), Onvio (estatisticas-funcionarios,
-- estatisticas-satisfacao), Workmonitor (Workmonitor_performance)

CREATE TABLE IF NOT EXISTS dim_empresa (
  emp_id        int PRIMARY KEY,
  cnpj          text UNIQUE,
  razao_social  text,
  cidade        text,
  estado        text
);

CREATE TABLE IF NOT EXISTS dim_colaborador (
  id            bigserial PRIMARY KEY,
  nome          text NOT NULL,
  nome_key      text NOT NULL, -- primeiro token do nome em maiusculas (merge Onvio <-> Workmonitor)
  departamento  text,
  UNIQUE (nome_key)
);

CREATE TABLE IF NOT EXISTS fact_entrega (
  id              bigserial PRIMARY KEY,
  emp_id          int REFERENCES dim_empresa(emp_id),
  obrigacao       text,
  tipo            text,          -- Obrigacao | Tarefa
  status          text,
  status_class    text,          -- entregue | pendente | dispensada | outro
  is_reinf        boolean DEFAULT false,
  departamento    text,          -- rotulo de departamento vindo do S3D (Responsavel entrega)
  data_entrega    date,
  prazo_tecnico   date,
  competencia     date,
  UNIQUE (emp_id, obrigacao, competencia) -- chave natural p/ upsert idempotente no ETL
);

CREATE INDEX IF NOT EXISTS ix_entrega_filtro
  ON fact_entrega (data_entrega, departamento, is_reinf, status_class);

CREATE TABLE IF NOT EXISTS fact_produtividade (
  id              bigserial PRIMARY KEY,
  colaborador_id  bigint REFERENCES dim_colaborador(id),
  data            date NOT NULL,
  concluidos      int DEFAULT 0,
  iniciados       int DEFAULT 0,
  tempo_medio_s   int,
  satisfacao      numeric(4,2),
  UNIQUE (colaborador_id, data)
);

CREATE INDEX IF NOT EXISTS ix_produtividade_data
  ON fact_produtividade (data);

CREATE TABLE IF NOT EXISTS fact_performance (
  id              bigserial PRIMARY KEY,
  colaborador_id  bigint REFERENCES dim_colaborador(id),
  data            date NOT NULL,
  produtivo_s     int DEFAULT 0,
  ocio_s          int DEFAULT 0,
  jornada_s       int DEFAULT 0,
  score_genia     numeric(5,2),
  alertas         int DEFAULT 0,
  UNIQUE (colaborador_id, data)
);

CREATE INDEX IF NOT EXISTS ix_performance_data
  ON fact_performance (data);
