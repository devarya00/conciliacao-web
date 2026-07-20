export type RelatorioStatus = 'processando' | 'concluido' | 'erro';

export interface RelatorioGerado {
  id: number;
  nome_empresa: string;
  status: RelatorioStatus;
  erro_msg: string | null;
  arquivo_balancete: string;
  arquivo_resumo: string;
  arquivo_xlsx: string | null;
  criado_por: number | null;
  created_at: string;
}
