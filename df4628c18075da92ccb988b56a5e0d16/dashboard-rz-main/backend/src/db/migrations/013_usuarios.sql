-- Usuarios de acesso ao BI. Sem cadastro publico: inseridos direto no banco
-- (ou via `npm run user:create`, que gera o hash da senha).
CREATE TABLE IF NOT EXISTS usuarios (
  id            bigserial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  senha_hash    text NOT NULL,
  role          text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  ativo         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
