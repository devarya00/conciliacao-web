export interface ReviewQueueGrupo {
  id: number;
  rawName: string;
  rawDept: string;
  sourceFiles: string[];
  pendentes: number;
  criadoEm: string;
}

export interface SugestaoColaborador {
  employeeId: number;
  canonicalName: string;
  score: number;
}

export interface ContagemPendentes {
  grupos: number;
  linhas: number;
}

export interface ResultadoAprovacao {
  employeeId: number;
  canonicalName: string;
  linhasAprovadas: number;
}

export interface ResponsavelNaoMapeado {
  rawResponsavelS3d: string;
  ocorrencias: number;
}

export interface ResponsavelAtivo {
  nomeCanonico: string;
  departamento: string | null;
}

export interface ResultadoVinculo {
  rawResponsavelS3d: string;
  nomeCanonico: string;
  departamento: string | null;
  linhasReprocessadas: number;
}

export interface Colaborador {
  id: number;
  nome: string;
  departamento: string | null;
  status: 'ativo' | 'inativo';
}

export interface ResultadoMesclagem {
  linhasReatribuidas: number;
}
