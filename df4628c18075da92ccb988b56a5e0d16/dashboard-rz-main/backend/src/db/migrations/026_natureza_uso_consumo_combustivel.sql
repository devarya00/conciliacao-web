-- Ampliar natureza pra cobrir compras que nao sao mercadoria pra revenda nem
-- frete/servico "puro" - descoberto testando a Jovane (prestadora de
-- servicos, com uso e consumo e combustivel na secao ENTRADAS). Seed so' com
-- os 2 codigos confirmados com dado real (debito da conta bate exato);
-- 900/904 (servico prestado, saida) ficam de fora ate' confirmar com o
-- escritorio o que representam - nao seedar por suposicao.
ALTER TABLE acumulador_classificacao DROP CONSTRAINT IF EXISTS acumulador_classificacao_natureza_check;
ALTER TABLE acumulador_classificacao ADD CONSTRAINT acumulador_classificacao_natureza_check
  CHECK (natureza IN ('MERCADORIA', 'FRETE', 'SERVICO', 'IMOBILIZADO', 'USO_CONSUMO', 'COMBUSTIVEL', 'OUTROS'));

INSERT INTO acumulador_classificacao (empresa_cnpj, codigo_acumulador, natureza, prazo, conta_destino_pattern, origem) VALUES
  (NULL, '107', 'USO_CONSUMO', 'PRAZO', 'ESTOQUE%',            'PADRAO'),
  (NULL, '119', 'COMBUSTIVEL', 'PRAZO', 'DESPESA COM COMBUST%', 'PADRAO')
ON CONFLICT (empresa_cnpj, codigo_acumulador) DO NOTHING;
