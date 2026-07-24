-- Remove o gerador de relatório gerencial + checklist de conferência
-- contábil (feature inteira removida do backend/frontend). Filhas antes das
-- pais; CASCADE cobre qualquer índice/constraint dependente.
DROP TABLE IF EXISTS conferencia_item CASCADE;
DROP TABLE IF EXISTS conferencia_passo CASCADE;
DROP TABLE IF EXISTS acumulador_classificacao CASCADE;
DROP TABLE IF EXISTS relatorio_gerado CASCADE;
