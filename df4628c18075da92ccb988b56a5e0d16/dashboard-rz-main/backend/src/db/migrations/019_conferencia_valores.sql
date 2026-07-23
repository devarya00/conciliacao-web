-- Regras automaticas de comparacao numerica (Fornecedores/Estoque/Receita x
-- resumo por acumulador) passam a gravar os valores em colunas separadas -
-- exibicao vira tabela compacta (Regra/Status/Descricao/Vlr Fiscal/
-- Vlr Contabil/Diferenca) em vez de paragrafo de texto, tanto no PDF de
-- conferencia quanto na tela.
ALTER TABLE conferencia_item ADD COLUMN IF NOT EXISTS valor_fiscal numeric;
ALTER TABLE conferencia_item ADD COLUMN IF NOT EXISTS valor_contabil numeric;
