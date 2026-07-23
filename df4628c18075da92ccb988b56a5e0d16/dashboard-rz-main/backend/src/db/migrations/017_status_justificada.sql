-- classifyStatus (common/text.util.ts) passa a separar "justificada" de
-- "pendente" (antes eram a mesma status_class). Backfill das linhas ja
-- ingeridas: mesmo criterio de texto que o parser aplica em ingestoes novas.
UPDATE fact_entrega
SET status_class = 'justificada'
WHERE status_class = 'pendente'
  AND (
    status ILIKE 'pend. justificada%'
    OR status ILIKE 'pend justificada%'
    OR status ILIKE 'atraso justificado%'
  );

-- DATA_MESTRE do dashboard passa de COALESCE(data_entrega, prazo_tecnico) pra
-- prazo_tecnico puro (planilha S3D - mesmo campo em toda linha, entregue ou
-- nao). Indice antigo tinha data_entrega como coluna lider; refeito com
-- prazo_tecnico pra continuar cobrindo o range scan do filtro de periodo.
DROP INDEX IF EXISTS ix_entrega_filtro;
CREATE INDEX IF NOT EXISTS ix_entrega_filtro
  ON fact_entrega (prazo_tecnico, departamento, is_reinf, status_class);
