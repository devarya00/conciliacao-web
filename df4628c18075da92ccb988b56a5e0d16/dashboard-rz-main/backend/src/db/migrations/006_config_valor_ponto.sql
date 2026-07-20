-- Valor do ponto (R$) em reais, historico por vigencia mensal: cada linha vale
-- "a partir deste mes, o ponto passa a valer X" ate a proxima linha configurada.
CREATE TABLE IF NOT EXISTS config_valor_ponto (
  competencia   date PRIMARY KEY,  -- primeiro dia do mes (YYYY-MM-01), mesmo padrao de fact_entrega.competencia
  valor         numeric(6,2) NOT NULL
);
