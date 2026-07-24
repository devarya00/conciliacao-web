-- Snapshot dos acumuladores que A07/A08 encontraram sem classificacao (ou
-- INDEFINIDO) no relatorio - conferencia_auto.py agora devolve isso junto
-- com os itens, pra tela oferecer um caminho de classificar em vez de deixar
-- a regra amarela pra sempre (ver relatorios.service.ts classificarAcumulador).
ALTER TABLE relatorio_gerado ADD COLUMN IF NOT EXISTS acumuladores_pendentes jsonb;
