export type Origem =
  | 's3d'
  | 'onvio_produtividade'
  | 'onvio_satisfacao'
  | 'workmonitor'
  | 'workmonitor_analitico'
  | 'legenda_tarefas';

export const ORIGENS: Origem[] = [
  's3d',
  'onvio_produtividade',
  'onvio_satisfacao',
  'workmonitor',
  'workmonitor_analitico',
  'legenda_tarefas',
];

/** Trecho (case-insensitive, sem acento) esperado no nome do arquivo de cada origem, usado no scan/classificacao. */
export const FILE_HINTS: Record<Origem, string> = {
  s3d: 's3d',
  onvio_produtividade: 'estatisticas-funcionarios',
  onvio_satisfacao: 'estatisticas-satisfa',
  workmonitor: 'workmonitor',
  workmonitor_analitico: 'export_analitico',
  legenda_tarefas: 'legenda',
};

export const ORIGEM_LABEL: Record<Origem, string> = {
  s3d: 'Acessórias · S3D gestão de entregas',
  onvio_produtividade: 'Onvio · estatísticas-funcionários',
  onvio_satisfacao: 'Onvio · estatísticas-satisfação',
  workmonitor: 'Workmonitor · performance',
  workmonitor_analitico: 'Workmonitor · analítico de jornada (export_analitico)',
  legenda_tarefas: 'Legenda de tarefas (pontuação)',
};

/**
 * Ordem de ingestao em lote. Colaboradores/empresas nascem em s3d e
 * onvio_produtividade; workmonitor resolve por nome; jornada tambem precisa dos
 * colaboradores. onvio_satisfacao vai por ULTIMO porque so atualiza satisfacao
 * em cima de fact_produtividade ja existente (e "nota mais recente vence", entao
 * arquivos mais novos por ultimo). legenda e independente.
 */
export const ORDEM_INGESTAO: Origem[] = [
  'legenda_tarefas',
  's3d',
  'onvio_produtividade',
  'workmonitor',
  'workmonitor_analitico',
  'onvio_satisfacao',
];
