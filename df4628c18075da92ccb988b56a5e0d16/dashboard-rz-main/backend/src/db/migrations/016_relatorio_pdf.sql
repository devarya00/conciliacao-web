-- Gerador de relatório gerencial passa a gravar também um PDF detalhado
-- (KPIs, DRE, balanço, fornecedores, movimento fiscal, apontamentos), além
-- do xlsx que já existia.
ALTER TABLE relatorio_gerado ADD COLUMN IF NOT EXISTS arquivo_pdf text;
