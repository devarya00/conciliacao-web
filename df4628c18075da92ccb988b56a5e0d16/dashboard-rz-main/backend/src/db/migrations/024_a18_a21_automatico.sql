-- A18-A21 deixam de ser nao_verificavel por default (falta de regra) -
-- descobrimos que a DRE inteira e' derivavel do proprio Balancete ja
-- extraido (Receita/Custos/Despesas sao as mesmas "Contas de Resultado" que
-- ja vivem la), sem precisar de upload de PDF novo nenhum. Ver dre.py e as
-- regras regra_capital_social_alterado/regra_custeio_exclusivo/
-- regra_apropriacao_impostos em conferencia_auto.py.
UPDATE conferencia_passo SET regra_automatica = 'capital_social_alterado' WHERE codigo = 'A18';
UPDATE conferencia_passo SET regra_automatica = 'custeio_exclusivo' WHERE codigo IN ('A19', 'A20');
UPDATE conferencia_passo SET regra_automatica = 'apropriacao_impostos' WHERE codigo = 'A21';
