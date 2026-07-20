-- Workmonitor_performance real expõe total_neutro_segs e total_improdutivo_segs
-- separados de produtivo/ocio; preserva a granularidade em vez de descartar.
ALTER TABLE fact_performance
  ADD COLUMN IF NOT EXISTS neutro_s int DEFAULT 0;

ALTER TABLE fact_performance
  ADD COLUMN IF NOT EXISTS improdutivo_s int DEFAULT 0;
