export type StatusTarefa = 'pendentes' | 'justificadas' | 'entregues' | 'dispensadas';

/** Chave do card/checkbox (front) -> status_class (back, fact_entrega). */
export const STATUS_TAREFA_CLASSE: Record<StatusTarefa, string> = {
  pendentes: 'pendente',
  justificadas: 'justificada',
  entregues: 'entregue',
  dispensadas: 'dispensada',
};

export interface Kpi {
  empresas: number;
  tarefas: number;
  reinfFechados: number;
  reinfPendentes: number;
  pendentes: number;
  justificadas: number;
  entregues: number;
  dispensadas: number;
  totalTarefas: number;
}

export interface Ranking {
  colaboradorId: number;
  nome: string;
  departamento: string | null;
  concluidos: number;
  abertos: number;
  tempoMedioS: number | null;
  satisfacao: number | null;
  scoreGenia: number | null;
  pontosTarefas: number;
  pontosAtendimento: number;
  pontosTotal: number;
  atendimentosMuitoSatisfeito: number;
  entregasConcluidas: number;
  entregasAbertas: number;
  premio: number;
}

export interface TaskType {
  obrigacao: string;
  volume: number;
  percentual: number;
}

export interface Reinf {
  fechados: number;
  aFechar: number;
  percentualConclusao: number;
}

export interface EmpresaAtendida {
  empId: number;
  razaoSocial: string | null;
  cnpj: string | null;
  cidade: string | null;
  estado: string | null;
}

export interface FiltrosOptions {
  departamentos: string[];
  colaboradores: { id: number; nome: string }[];
  minData: string | null;
  maxData: string | null;
}
