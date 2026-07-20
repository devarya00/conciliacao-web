-- Rastreio de planilhas enviadas: cada arquivo ingerido vira uma linha em
-- arquivo_ingestao; as facts geradas a partir dele guardam o arquivo_id, entao
-- excluir o arquivo remove (via CASCADE) apenas os dados que vieram dele.

CREATE TABLE IF NOT EXISTS arquivo_ingestao (
  id                bigserial PRIMARY KEY,
  nome_original     text NOT NULL,
  caminho_arquivo   text NOT NULL,
  origem            text NOT NULL, -- s3d | onvio_produtividade | onvio_satisfacao | workmonitor
  tamanho_bytes     bigint,
  status            text NOT NULL DEFAULT 'pendente', -- pendente | processado | erro
  mensagem_erro     text,
  enviado_em        timestamptz NOT NULL DEFAULT now(),
  processado_em     timestamptz,
  UNIQUE (nome_original, origem)
);

ALTER TABLE fact_entrega
  ADD COLUMN IF NOT EXISTS arquivo_id bigint REFERENCES arquivo_ingestao(id) ON DELETE CASCADE;

ALTER TABLE fact_produtividade
  ADD COLUMN IF NOT EXISTS arquivo_id bigint REFERENCES arquivo_ingestao(id) ON DELETE CASCADE;

ALTER TABLE fact_produtividade
  ADD COLUMN IF NOT EXISTS satisfacao_arquivo_id bigint REFERENCES arquivo_ingestao(id) ON DELETE SET NULL;

ALTER TABLE fact_performance
  ADD COLUMN IF NOT EXISTS arquivo_id bigint REFERENCES arquivo_ingestao(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ix_entrega_arquivo ON fact_entrega (arquivo_id);
CREATE INDEX IF NOT EXISTS ix_produtividade_arquivo ON fact_produtividade (arquivo_id);
CREATE INDEX IF NOT EXISTS ix_produtividade_satisfacao_arquivo ON fact_produtividade (satisfacao_arquivo_id);
CREATE INDEX IF NOT EXISTS ix_performance_arquivo ON fact_performance (arquivo_id);

-- estatisticas-satisfacao so atualiza a coluna satisfacao de fact_produtividade
-- (nao cria linha propria), entao o FK sozinho nao apaga o dado ao excluir o
-- arquivo. O trigger zera nota + vinculo antes do arquivo ser removido.
CREATE OR REPLACE FUNCTION limpar_satisfacao_ao_deletar_arquivo() RETURNS trigger AS $$
BEGIN
  UPDATE fact_produtividade
     SET satisfacao = NULL, satisfacao_arquivo_id = NULL
   WHERE satisfacao_arquivo_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_limpar_satisfacao ON arquivo_ingestao;
CREATE TRIGGER trg_limpar_satisfacao
  BEFORE DELETE ON arquivo_ingestao
  FOR EACH ROW EXECUTE FUNCTION limpar_satisfacao_ao_deletar_arquivo();
