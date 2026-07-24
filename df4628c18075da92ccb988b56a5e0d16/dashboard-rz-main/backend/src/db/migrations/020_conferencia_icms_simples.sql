-- Novo passo automatico: credito de ICMS (conta "ICMS A Recuperar") movimentado
-- em empresa do Simples Nacional. Empresa do Simples nao apura ICMS proprio
-- (o imposto vai embutido no DAS) - um debito nessa conta no periodo costuma
-- ser erro de parametrizacao da integracao contabil (credito de ICMS que nao
-- deveria ter sido gerado). So dispara quando A06 (Simples Nacional) ja
-- identificou o regime pela conta "Simples Nacional a Recolher" existir.
INSERT INTO conferencia_passo (codigo, grupo, ordem, titulo, descricao, regra_automatica) VALUES
('A24', 'A', 24, 'Crédito de ICMS indevido em empresa do Simples Nacional',
 $$Empresa optante pelo Simples Nacional recolhe o ICMS embutido no DAS - nao apura credito/debito de ICMS proprio.
Se a conta "ICMS A Recuperar" (ou equivalente) tiver movimento de debito no periodo, provavelmente a integracao contabil
gerou credito de ICMS indevidamente (parametrizacao incorreta no fiscal).
Corrigir a parametrizacao da integracao contabil pra nao gerar esse credito em empresas do Simples.$$,
 'icms_credito_simples')
ON CONFLICT (codigo) DO NOTHING;
