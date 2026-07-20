export type RelatorioStatus = 'processando' | 'concluido' | 'erro';

export interface RelatorioGerado {
  id: number;
  nome_empresa: string;
  status: RelatorioStatus;
  erro_msg: string | null;
  arquivo_xlsx: string | null;
  created_at: string;
}
