export class FiltrosOptionsDto {
  departamentos: string[];
  colaboradores: { id: number; nome: string }[];
  minData: string | null;
  maxData: string | null;
}
