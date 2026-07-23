export type RelatorioStatus =
  | 'processando'
  | 'aguardando_conferencia'
  | 'processando_final'
  | 'concluido'
  | 'erro';

export interface RelatorioGerado {
  id: number;
  nome_empresa: string;
  competencia: string | null;
  status: RelatorioStatus;
  erro_msg: string | null;
  arquivo_balancete: string;
  arquivo_resumo: string;
  arquivo_xlsx: string | null;
  arquivo_pdf: string | null;
  criado_por: number | null;
  created_at: string;
}
