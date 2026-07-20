/**
 * Roster canonico de colaboradores - conhecimento REVISADO COM STAKEHOLDER,
 * originado em gestao-entregas-package/gestao_entregas.db (tabela `responsaveis`,
 * scripts merges.sql / active_flags.sql). Aplicado por
 * IngestaoService.aplicarRosterCanonico sobre dim_colaborador (keyed por nome_key).
 *
 * Fonte de cada decisao:
 *  - Inativos e rotulos de setor: active_flags.sql + tabela responsaveis do .db.
 *  - Merge "Sucesso do Cliente" -> Lauriane: merges.sql (nao aparece no dashboard
 *    como colaborador proprio, entao nao precisa de entrada aqui).
 *  - Merges LISA->LISAMARA e MARIA->MARIA BEATRIZ: inferencia cross-planilha
 *    (S3D usa "Lisa"/"Maria Beatriz"; Onvio/Workmonitor usam "Lisamara"/"Maria"),
 *    CONFIRMADA pelo stakeholder nesta rodada.
 *
 * Chaves = nome_key (1o token do nome em maiusculas, deterministico - ver
 * common/text.util). Estavel entre re-ingests, por isso serve de chave do seed.
 */

/** nome_key perdedor -> nome_key canonico (mesma pessoa fragmentada pelo 1o-token). */
export const ROSTER_MERGES: Record<string, string> = {
  LISA: 'LISAMARA', // Lisa Dp Fiscal-contabil (S3D) == Lisamara Dias (Onvio/Workmonitor)
  MARIA: 'MARIA BEATRIZ', // "Maria" == Maria Beatriz (BPO); Maria Clara fica separada
  ISADORA: 'ISADORA ESTAGIARIA', // linha nome_key=ISADORA tem nome "Isadora Estagiaria" (inativa); a Isadora ativa e ISADORA - (Isadora - Dp)
};

/** Colaboradores que sairam da empresa (historico preservado, fora do "atual"). */
export const ROSTER_INATIVOS: string[] = [
  'VITOR', // Vitor Rezende
  'DOMINIQUE', // Dominique Dp
  'ANA', // Ana Ruth de Sena Nunes
  'ISADORA ESTAGIARIA', // Isadora Estagiaria (a Isadora - Dp continua ativa)
];

/** Rotulos de setor/genericos que NAO sao individuos - fora de ranking por pessoa. */
export const ROSTER_NAO_PESSOA: string[] = [
  'BPO-ASSISTENTE',
  'DEP.',
  'DEP. ADMINISTRATIVO',
  'DEP. FISCAL',
  'DEP. PESSOAL',
  'DEP. PESSOAL1',
  'DEP. PESSSOAL3',
  'DEPART.FISCAL.E.CONTABIL.1',
  'DEPART.FISCAL.E.CONTABIL.2',
  'DEPART.FISCAL.E.CONTABIL.3',
  'DEPART.FISCAL.E.CONTABIL.4',
  'DEPART.FISCAL.E.CONTÁBIL',
  'DIRETORIA',
  'FISCAL', // "Fiscal 6"
  'TESTE',
];
