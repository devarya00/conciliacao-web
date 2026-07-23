/**
 * Corrige mojibake Latin-1 lido como UTF-8 (ex.: "ContÃ¡bil" -> "Contábil").
 * Os XLSX de origem as vezes trazem strings gravadas em Latin-1 dentro de um
 * encoding UTF-8 declarado; heuristica: se a string contem os pares de bytes
 * caracteristicos (Ã seguido de caractere de acentuacao), re-decodifica.
 */
export function normalizeEncoding(value: string | null | undefined): string {
  if (!value) return '';
  const mojibake = /Ã[\x80-\xBF]/;
  if (!mojibake.test(value)) return value.trim();
  try {
    const fixed = Buffer.from(value, 'latin1').toString('utf8');
    return fixed.trim();
  } catch {
    return value.trim();
  }
}

/** status_class: Ent.* -> entregue; Pend. justificada/Atraso justificado -> justificada; Pendente/Atrasada/Prazo tecnico -> pendente; Dispensada -> dispensada; demais -> outro. */
export function classifyStatus(statusRaw: string | null | undefined): string {
  const status = normalizeEncoding(statusRaw).toLowerCase();
  if (!status) return 'outro';
  if (status.startsWith('ent')) return 'entregue';
  if (
    status.startsWith('pend. justificada') ||
    status.startsWith('pend justificada') ||
    status.startsWith('atraso justificado')
  ) {
    return 'justificada';
  }
  if (
    status.startsWith('pendente') ||
    status.startsWith('atrasada') ||
    status.startsWith('prazo tecnico') ||
    status.startsWith('prazo técnico')
  ) {
    return 'pendente';
  }
  if (status.startsWith('dispensada')) return 'dispensada';
  return 'outro';
}

/** is_reinf: verdadeiro quando obrigacao contem "reinf" (case-insensitive). */
export function isReinf(obrigacao: string | null | undefined): boolean {
  return normalizeEncoding(obrigacao).toLowerCase().includes('reinf');
}

/**
 * Chave normalizada de obrigacao/tarefa p/ casar fact_entrega.obrigacao (S3D) com
 * dim_tarefa_pontos.obrigacao_key (legenda) mesmo com diferenca de acento/espacos.
 */
export function chaveObrigacao(value: string | null | undefined): string {
  const clean = normalizeEncoding(value);
  return clean
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** nome_key: primeiro token do nome em maiusculas - chave de merge Onvio <-> Workmonitor. */
export function nomeKey(nome: string | null | undefined): string {
  const clean = normalizeEncoding(nome);
  const primeiro = clean.split(/\s+/)[0] || '';
  return primeiro.toUpperCase();
}

/**
 * Gera nome_key por lote, com desambiguacao: se o primeiro-token de duas pessoas
 * diferentes do MESMO arquivo colide (ex.: "Maria Beatriz" e "Maria Clara" ->
 * "MARIA"), usa os 2 primeiros tokens so para essas colidentes. Demais mantem
 * chave de 1 token (comportamento padrao). Funciona entre arquivos pq as fontes
 * reais (Onvio/Workmonitor) ja trazem nome completo exatamente quando ha colisao.
 */
export function resolverNomeKeys(nomes: (string | null | undefined)[]): string[] {
  const limpos = nomes.map((n) => normalizeEncoding(n));
  const distintosPorPrimeiroToken = new Map<string, Set<string>>();

  for (const nome of limpos) {
    if (!nome) continue;
    const primeiro = nomeKey(nome);
    const comparavel = nome.toUpperCase().replace(/\s+/g, ' ').trim();
    if (!distintosPorPrimeiroToken.has(primeiro)) distintosPorPrimeiroToken.set(primeiro, new Set());
    distintosPorPrimeiroToken.get(primeiro)!.add(comparavel);
  }

  return limpos.map((nome) => {
    if (!nome) return '';
    const primeiro = nomeKey(nome);
    const colide = (distintosPorPrimeiroToken.get(primeiro)?.size ?? 0) > 1;
    if (!colide) return primeiro;
    return nome.trim().split(/\s+/).slice(0, 2).join(' ').toUpperCase();
  });
}
