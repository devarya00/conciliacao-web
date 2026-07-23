export type ConferenciaStatus = 'pendente' | 'ok' | 'divergencia' | 'nao_verificavel';

export interface ConferenciaPasso {
  id: number;
  codigo: string;
  grupo: 'A' | 'B';
  ordem: number;
  titulo: string;
  descricao: string | null;
  regraAutomatica: string | null;
}

export interface ConferenciaItem {
  id: number;
  relatorioGeradoId: number;
  passo: ConferenciaPasso;
  status: ConferenciaStatus;
  observacao: string | null;
  /** Preenchidos só nas regras de comparação numérica (Fornecedores/Estoque/Receita x resumo). */
  valorFiscal: number | null;
  valorContabil: number | null;
  sugeridoAutomatico: boolean;
  atualizadoPor: number | null;
  atualizadoEm: string;
}

export interface ConferenciaProgresso {
  totalAutomatizavel: number;
  okAutomatizavel: number;
  divergenciaAutomatizavel: number;
  totalGeral: number;
}

export interface ConferenciaResponse {
  itens: ConferenciaItem[];
  progresso: ConferenciaProgresso;
  podeGerarFinal: boolean;
}
