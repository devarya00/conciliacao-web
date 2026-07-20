-- Jobs do gerador de relatório gerencial (upload de PDFs Domínio -> xlsx).
-- Acessível a qualquer usuário autenticado (admin ou user), diferente do BI
-- (restrito a admin).
CREATE TABLE IF NOT EXISTS relatorio_gerado (
  id                  bigserial PRIMARY KEY,
  nome_empresa        text NOT NULL,
  status              text NOT NULL DEFAULT 'processando'
                       CHECK (status IN ('processando', 'concluido', 'erro')),
  erro_msg            text,
  arquivo_balancete   text NOT NULL,
  arquivo_resumo      text NOT NULL,
  arquivo_xlsx        text,
  criado_por          bigint REFERENCES usuarios(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
