export interface StatusTempo {
  data: string;
  produtivoS: number;
  ocioS: number;
  improdutivoS: number;
  neutroS: number;
}

export interface WorkmonitorTotais {
  produtivoS: number;
  improdutivoS: number;
  ocioS: number;
  neutroS: number;
}

export interface WorkmonitorColaborador {
  colaboradorId: number;
  nome: string;
  jornadaS: number;
  captadasS: number;
  produtivoS: number;
  percentualProdutivo: number;
  score: number | null;
}
