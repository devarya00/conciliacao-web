-- Classificacao de acumulador fiscal (natureza/prazo) como dado, nao codigo.
-- Antes, A07/A08 tratavam natureza (mercadoria/frete/servico) e prazo
-- (a vista/a prazo) de cada codigo de acumulador via lista fixa no Python -
-- funciona pro plano padrao Domínio, mas quebra silenciosamente pra empresa
-- cujo cadastro de acumuladores fuja do padrao (codigo novo, renumerado etc).
-- Agora e' tabela: catalogo global (empresa_cnpj NULL) com override por
-- empresa quando o auditor confirma manualmente uma classificacao (ou quando
-- o padrao global nao se aplica a essa empresa).
--
-- Nao existe entidade "empresa" com uuid neste sistema (relatorio_gerado so
-- tem nome_empresa livre) - por isso a chave e' o CNPJ (texto, extraido do
-- proprio PDF do balancete), nao um empresa_id uuid.
ALTER TABLE relatorio_gerado ADD COLUMN IF NOT EXISTS cnpj text;

CREATE TABLE IF NOT EXISTS acumulador_classificacao (
  id                    bigserial PRIMARY KEY,
  empresa_cnpj          text NULL,  -- NULL = regra padrao global
  codigo_acumulador     text NOT NULL,
  natureza              text NOT NULL CHECK (natureza IN ('MERCADORIA', 'FRETE', 'SERVICO', 'IMOBILIZADO', 'OUTROS')),
  prazo                 text NOT NULL CHECK (prazo IN ('VISTA', 'PRAZO', 'INDEFINIDO')),
  conta_destino_pattern text,
  origem                text NOT NULL DEFAULT 'PADRAO' CHECK (origem IN ('PADRAO', 'INFERIDO', 'CONFIRMADO_USUARIO')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_cnpj, codigo_acumulador)
);
CREATE INDEX IF NOT EXISTS idx_acumulador_classificacao_cnpj ON acumulador_classificacao(empresa_cnpj);

-- Seed global (padrao Domínio). codigo 103 (ST dentro do estado) fica
-- INDEFINIDO de proposito - o nome do acumulador descreve natureza tributaria
-- (ST, dentro/fora do estado), nao prazo de pagamento; nao da pra inferir
-- "a prazo" so pelo nome. Fica pendente de confirmacao por empresa/auditor.
INSERT INTO acumulador_classificacao (empresa_cnpj, codigo_acumulador, natureza, prazo, conta_destino_pattern, origem) VALUES
  (NULL, '100', 'MERCADORIA', 'VISTA',      '%ESTOQUE%',    'PADRAO'),
  (NULL, '101', 'MERCADORIA', 'PRAZO',      '%ESTOQUE%',    'PADRAO'),
  (NULL, '103', 'MERCADORIA', 'INDEFINIDO', '%ESTOQUE%',    'PADRAO'),
  (NULL, '104', 'MERCADORIA', 'PRAZO',      '%ESTOQUE%',    'PADRAO'),
  (NULL, '301', 'FRETE',      'PRAZO',      '%FORNECEDOR%', 'PADRAO'),
  (NULL, '401', 'SERVICO',    'PRAZO',      '%FORNECEDOR%', 'PADRAO')
ON CONFLICT (empresa_cnpj, codigo_acumulador) DO NOTHING;
