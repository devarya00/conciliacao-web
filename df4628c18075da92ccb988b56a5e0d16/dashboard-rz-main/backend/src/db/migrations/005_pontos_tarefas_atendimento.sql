-- Sistema de pontuacao: legenda de pontos por obrigacao/tarefa, colaborador
-- responsavel por entrega, e contagem de atendimentos avaliados.

-- Legenda de pontos por obrigacao/tarefa (dimensao/referencia, nao fact - sem CASCADE).
CREATE TABLE IF NOT EXISTS dim_tarefa_pontos (
  obrigacao_key   text PRIMARY KEY,  -- chave normalizada (upper+sem acento+trim) p/ join robusto
  obrigacao       text NOT NULL,     -- nome original (ultima linha do CSV vence)
  classificacao   text,
  pontos          int NOT NULL,
  departamento    text,
  arquivo_id      bigint REFERENCES arquivo_ingestao(id) ON DELETE SET NULL
);

ALTER TABLE fact_entrega
  ADD COLUMN IF NOT EXISTS colaborador_id bigint REFERENCES dim_colaborador(id);
CREATE INDEX IF NOT EXISTS ix_entrega_colaborador ON fact_entrega (colaborador_id);

-- Um atendimento avaliado = uma linha (diferente de fact_produtividade.satisfacao,
-- que so guarda a nota mais recente aplicada em bloco a todas as linhas do
-- colaborador - ver aplicarSatisfacao() no ingestao.service).
CREATE TABLE IF NOT EXISTS fact_atendimento (
  id              bigserial PRIMARY KEY,
  colaborador_id  bigint REFERENCES dim_colaborador(id),
  data            date NOT NULL,
  nota            numeric(4,2) NOT NULL,
  arquivo_id      bigint REFERENCES arquivo_ingestao(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_atendimento_colaborador_data ON fact_atendimento (colaborador_id, data);
CREATE INDEX IF NOT EXISTS ix_atendimento_arquivo ON fact_atendimento (arquivo_id);
