-- ingestion_review_queue precisa distinguir pending/approved/rejected (nao so
-- resolved_at) e guardar o payload da linha de performance pendente, pra
-- aprovar/rejeitar poder gravar em fact_performance sem reler o arquivo original.
ALTER TABLE ingestion_review_queue
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS payload jsonb;

DROP INDEX IF EXISTS ix_review_queue_pendentes;
CREATE INDEX IF NOT EXISTS ix_review_queue_pendentes
  ON ingestion_review_queue (created_at) WHERE status = 'pending';
