-- estatisticas-funcionarios (Onvio) real expõe Abertos e Desconsiderados alem de
-- Concluidos/Iniciados; preserva a granularidade em vez de descartar.
ALTER TABLE fact_produtividade
  ADD COLUMN IF NOT EXISTS abertos int DEFAULT 0;

ALTER TABLE fact_produtividade
  ADD COLUMN IF NOT EXISTS desconsiderados int DEFAULT 0;
