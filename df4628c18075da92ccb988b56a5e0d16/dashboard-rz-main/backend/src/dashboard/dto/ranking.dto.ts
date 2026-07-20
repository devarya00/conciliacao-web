export class RankingDto {
  colaboradorId: number;
  nome: string;
  departamento: string | null;
  concluidos: number;
  abertos: number;
  tempoMedioS: number | null;
  satisfacao: number | null;
  scoreGenia: number | null; // null quando sem par no Workmonitor -> barra em cinza no front
  pontosTarefas: number;
  pontosAtendimento: number;
  pontosTotal: number;
  atendimentosMuitoSatisfeito: number; // contagem, nao pontos
  entregasConcluidas: number; // fact_entrega (S3D) entregue no periodo, base da tabela de pontuacao
  entregasAbertas: number; // fact_entrega (S3D) pendente no periodo
  premio: number; // R$, calculado com o valor do ponto vigente em cada mes (config_valor_ponto)
}
