import { distance } from 'fastest-levenshtein';

export const FUZZY_THRESHOLD = 88;

const STOPWORDS = new Set(['dp', 'do', 'da', 'de', 'setor', 'depto', 'dept']);

export interface AliasEntry {
  departamentoNormalizado: string;
  aliasNormalizado: string;
  colaboradorId: number;
  canonicalName: string;
}

export interface ResolutionResult {
  employeeId: number | null;
  canonicalName: string | null;
  matchType: 'exact' | 'fuzzy' | 'unresolved';
  score?: number;
}

/**
 * lowercase -> remove acentos (NFD) -> remove stopwords -> colapsa espacos.
 * Pontuacao e tratada como separador de token (planilhas reais trazem "Dep.
 * Fiscal e Contabil.5" etc.).
 */
export function normalizeAliasText(value: string | null | undefined): string {
  const semAcento = (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  const tokens = semAcento
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !STOPWORDS.has(token));

  return tokens.join(' ').trim();
}

/** token_sort_ratio: ordena os tokens de cada string, junta, compara por Levenshtein normalizado (0-100). */
export function tokenSortRatio(a: string, b: string): number {
  const ordenarJuntar = (v: string) => v.split(' ').filter(Boolean).sort().join(' ');
  const sa = ordenarJuntar(a);
  const sb = ordenarJuntar(b);
  const maxLen = Math.max(sa.length, sb.length);
  if (maxLen === 0) return 100;
  return Math.round((1 - distance(sa, sb) / maxLen) * 100);
}

/**
 * Resolucao em camadas, pura e deterministica: (a) exato na chave composta
 * departamento+alias; (b) fuzzy restrito ao mesmo departamento, score >= 88,
 * melhor score vence (empate -> primeiro encontrado); (c) unresolved.
 * Nunca compara aliases de departamentos diferentes entre si.
 *
 * `allowFuzzy` (default true): quando o departamento de origem e desconhecido
 * (planilha sem coluna de departamento, ex.: Workmonitor), o chamador deve
 * passar `false` pra suprimir a camada fuzzy (evita colapsar homonimos de
 * departamentos reais diferentes que aqui aparecem com o mesmo dept vazio).
 * O match exato continua ativo mesmo assim - reconhecer um alias ja aprovado
 * manualmente por um humano nao e "chute", e sem isso o mesmo nome nunca sai
 * da fila de revisao mesmo depois de aprovado uma vez.
 */
export function matchAlias(aliases: AliasEntry[], rawName: string, rawDept: string, allowFuzzy = true): ResolutionResult {
  const nameNorm = normalizeAliasText(rawName);
  const deptNorm = normalizeAliasText(rawDept);

  const exato = aliases.find(
    (alias) => alias.departamentoNormalizado === deptNorm && alias.aliasNormalizado === nameNorm,
  );
  if (exato) {
    return { employeeId: exato.colaboradorId, canonicalName: exato.canonicalName, matchType: 'exact' };
  }
  if (!allowFuzzy) {
    return { employeeId: null, canonicalName: null, matchType: 'unresolved' };
  }

  let melhor: { entry: AliasEntry; score: number } | null = null;
  for (const alias of aliases) {
    if (alias.departamentoNormalizado !== deptNorm) continue;
    const score = tokenSortRatio(nameNorm, alias.aliasNormalizado);
    if (score >= FUZZY_THRESHOLD && (!melhor || score > melhor.score)) {
      melhor = { entry: alias, score };
    }
  }
  if (melhor) {
    return {
      employeeId: melhor.entry.colaboradorId,
      canonicalName: melhor.entry.canonicalName,
      matchType: 'fuzzy',
      score: melhor.score,
    };
  }

  return { employeeId: null, canonicalName: null, matchType: 'unresolved' };
}
