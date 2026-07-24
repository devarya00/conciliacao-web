-- 3 novos passos automaticos, achados testando a Jovane:
-- A27: fornecedores com saldo credor mas ZERO baixa no periodo (30+
--      fornecedores, 531 mil, 2 meses sem nenhum pagamento registrado) -
--      conecta com B10/B11 do roteiro (baixa de parcelas), hoje NAO_VERIFICAVEL.
-- A28: imobilizado existe mas despesa de depreciacao do periodo esta zerada -
--      conecta com B17 (calculo de depreciacao), hoje NAO_VERIFICAVEL.
-- A29: depreciacao acumulada nao pode superar o custo do bem - so' agregado
--      (Balancete nao abre por bem individual), por isso o teto de severidade
--      e' INFORMATIVO exceto na impossibilidade matematica (CRITICO).
INSERT INTO conferencia_passo (codigo, grupo, ordem, titulo, descricao, regra_automatica) VALUES
('A27', 'A', 27, 'Fornecedores sem movimento de baixa no período',
 $$Se a conta de Fornecedores tem saldo credor mas nenhuma conta analitica teve debito (baixa/pagamento) no
periodo, provavelmente os pagamentos aos fornecedores nao foram lancados - ver passos B10/B11 (baixa de
parcelas de fornecedores/clientes) no Dominio.$$,
 'fornecedores_sem_baixa'),

('A28', 'A', 28, 'Imobilizado sem depreciação lançada no período',
 $$Se existe saldo em conta de Imobilizado e a despesa de depreciacao do periodo esta zerada, a depreciacao
provavelmente nao foi calculada/lancada - ver passo B17 (calculo de depreciacao) no Dominio.$$,
 'imobilizado_sem_depreciacao'),

('A29', 'A', 29, 'Depreciação acumulada vs. custo de aquisição do imobilizado',
 $$Depreciacao acumulada nunca pode superar o custo de aquisicao do bem (impossibilidade matematica). Bem
integralmente depreciado nao deve gerar mais despesa de depreciacao. O Balancete so' da o agregado por grupo
(ex.: "Veiculos"), sem abrir bem a bem - conferencia fina exige o Razao ou controle de patrimonio.$$,
 'depreciacao_vs_custo')
ON CONFLICT (codigo) DO NOTHING;
