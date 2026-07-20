export class WorkmonitorTotaisDto {
  produtivoS: number;
  improdutivoS: number;
  ocioS: number;
  neutroS: number;
}

export class WorkmonitorColaboradorDto {
  colaboradorId: number;
  nome: string;
  jornadaS: number;
  captadasS: number;
  produtivoS: number;
  percentualProdutivo: number;
  score: number | null;
}
