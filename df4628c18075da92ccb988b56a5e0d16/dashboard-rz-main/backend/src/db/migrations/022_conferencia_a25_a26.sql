-- Dois novos passos automaticos:
-- A25: fornecedor com movimento no periodo mas sem lastro fiscal individualizavel
--      (debito ~= credito no periodo - ciclo fechado, tipico de nota de
--      exercicio anterior baixada agora). Nunca CRITICO - e' indicativo.
-- A26: sangria de caixa - Caixa credor (A04) ja aponta o saldo negativo, mas
--      nao diz pra onde foi o dinheiro. Sem dado de partida dobrada no
--      extrator atual (so balancete agregado, sem razao/contrapartida), a
--      regra so consegue emitir NAO_VERIFICAVEL com o numero em aberto -
--      extracao do Razao contabil fica como dependencia de roadmap.
--
-- status 'atencao' e 'informativo' agora sao validos em conferencia_item
-- (antes so pendente/ok/divergencia/nao_verificavel) - severidade intermediaria
-- pra achado que e' indicativo, nao erro provado (ver A07 tambem).
ALTER TABLE conferencia_item DROP CONSTRAINT IF EXISTS conferencia_item_status_check;
ALTER TABLE conferencia_item ADD CONSTRAINT conferencia_item_status_check
  CHECK (status IN ('pendente', 'ok', 'atencao', 'divergencia', 'nao_verificavel', 'informativo'));

INSERT INTO conferencia_passo (codigo, grupo, ordem, titulo, descricao, regra_automatica) VALUES
('A25', 'A', 25, 'Fornecedor com movimento sem lastro fiscal no período',
 $$Contas analiticas de Fornecedores com debito e credito iguais no periodo (ciclo fechado) provavelmente
sao parcelas de nota fiscal de exercicio anterior, gerada e baixada dentro deste periodo - legitimo,
mas sem contrapartida no Resumo por Acumulador deste periodo (a nota entrou no periodo anterior).
Revisar a lista: confirmar que cada fornecedor citado realmente corresponde a uma nota antiga baixada,
nao um lancamento direto no razonete sem nota fiscal.$$,
 'fornecedor_sem_lastro'),

('A26', 'A', 26, 'Sangria de caixa — destino dos créditos de Caixa não explicado',
 $$A04 ja aponta se o Caixa fechou credor. Aqui o auditor precisa saber pra onde foi o dinheiro: se os
creditos (saidas) de Caixa no periodo superam os debitos (entradas) por uma margem relevante, verificar
manualmente no Dominio (Movimento > Caixa) quais lancamentos explicam a diferenca - fornecedor, imposto,
adiantamento a empregado, retirada de socio etc.$$,
 'sangria_caixa')
ON CONFLICT (codigo) DO NOTHING;
