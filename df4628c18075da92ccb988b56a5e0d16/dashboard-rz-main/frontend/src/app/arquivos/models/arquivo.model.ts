export type Origem =
  | 's3d'
  | 'onvio_produtividade'
  | 'onvio_satisfacao'
  | 'workmonitor'
  | 'legenda_tarefas'
  | 'depara_responsaveis';

export const ORIGEM_LABEL: Record<Origem, string> = {
  s3d: 'Acessórias · S3D gestão de entregas',
  onvio_produtividade: 'Onvio · estatísticas-funcionários',
  onvio_satisfacao: 'Onvio · estatísticas-satisfação',
  workmonitor: 'Workmonitor · performance',
  legenda_tarefas: 'Legenda de tarefas (pontuação)',
  depara_responsaveis: 'De-para responsáveis S3D (identidade canônica)',
};

export const ORIGENS: Origem[] = [
  's3d',
  'onvio_produtividade',
  'onvio_satisfacao',
  'workmonitor',
  'legenda_tarefas',
  'depara_responsaveis',
];

export interface Arquivo {
  id: number;
  nomeOriginal: string;
  origem: Origem;
  tamanhoBytes: number | null;
  status: 'pendente' | 'processado' | 'erro';
  mensagemErro: string | null;
  enviadoEm: string;
  processadoEm: string | null;
  registros: number;
  periodoInicio: string | null;
  periodoFim: string | null;
}

export interface FiltroArquivos {
  dataInicial?: string;
  dataFinal?: string;
}
