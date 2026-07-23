export interface Filtro {
  dataInicial: string;
  dataFinal: string;
  somenteReinf?: boolean;
  dedup?: boolean; // true = ultima ocorrencia da chave vence; false = conta cada reenvio/execucao recorrente
  departamento?: string; // 'Todos'
  colaborador?: string; // 'Todos'
  statusClasses?: string[]; // filtro dos cards de status (Ranking/Detalhamento de tarefas)
}

export function toParams(f: Filtro): Record<string, string> {
  const params: Record<string, string> = {
    dataInicial: f.dataInicial,
    dataFinal: f.dataFinal,
  };
  if (f.somenteReinf !== undefined) params['somenteReinf'] = String(f.somenteReinf);
  if (f.dedup !== undefined) params['dedup'] = String(f.dedup);
  if (f.departamento && f.departamento !== 'Todos') params['departamento'] = f.departamento;
  if (f.colaborador && f.colaborador !== 'Todos') params['colaborador'] = f.colaborador;
  if (f.statusClasses !== undefined) params['statusClasses'] = f.statusClasses.join(',');
  return params;
}
