-- Token de redefinição de senha: admin gera um link, usuário abre e define
-- a própria senha. Substitui a ideia de senha temporária passada por fora.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_expires timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ix_usuarios_reset_token
  ON usuarios (reset_token) WHERE reset_token IS NOT NULL;
