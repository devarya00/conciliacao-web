import * as XLSX from 'xlsx';
import { normalizeEncoding } from './text.util';

/**
 * Le a primeira sheet cujo nome contem `sheetNameHint` (case-insensitive) e
 * devolve as linhas como array de objetos { header: valor }, com headers
 * normalizados (trim + encoding). Cada workbook das 3 origens tem uma unica
 * sheet relevante por arquivo, mas o nome pode variar ("estatisticas-funcionarios"
 * vs "estatisticas_funcionarios" etc.) - por isso o match e parcial.
 */
export function readSheetRows(workbook: XLSX.WorkBook, sheetNameHint: string): Record<string, any>[] {
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase().includes(sheetNameHint.toLowerCase())) ??
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });

  return raw.map((row) => {
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const cleanKey = stripAccents(normalizeEncoding(key).toLowerCase());
      normalized[cleanKey] = typeof value === 'string' ? normalizeEncoding(value) : value;
    }
    return normalized;
  });
}

/** Remove acentos p/ casar headers como "Obrigação"/"Competência" com candidatos ASCII. */
export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Busca o primeiro header presente na linha dentre uma lista de nomes candidatos (ja normalizados/lowercase). */
export function pick(row: Record<string, any>, candidates: string[]): any {
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return null;
}

/** Converte serial do Excel ou string de data para 'YYYY-MM-DD'; retorna null se vazio/invalido. */
export function parseExcelDate(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return null;
    const mm = String(date.m).padStart(2, '0');
    const dd = String(date.d).padStart(2, '0');
    return `${date.y}-${mm}-${dd}`;
  }
  const str = String(value).trim();
  // dd/mm/yyyy
  const br = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const [, d, m, y] = br;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // yyyy-mm-dd (ja no formato)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

const MESES_PT: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
  jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
};

/** Converte competencia no formato "dez/25" / "jan/26" (S3D) para 'YYYY-MM-01'. */
export function parseCompetencia(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  const match = String(value).trim().toLowerCase().match(/^([a-z]{3})\/(\d{2})$/);
  if (!match) return parseExcelDate(value);
  const [, mes, ano] = match;
  const mm = MESES_PT[mes];
  if (!mm) return null;
  return `20${ano}-${mm}-01`;
}

export function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return isNaN(n) ? null : n;
}

/** Converte "HH:MM:SS" em segundos; retorna null se vazio/invalido. */
export function parseHms(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const match = String(value).trim().match(/^(\d{1,3}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/**
 * Extrai uma unica data (YYYY-MM-DD) de nomes de arquivo que exportam sempre 1 dia
 * por planilha, cobrindo os padroes observados:
 * - "..._YYYY-MM-DD_a_YYYY-MM-DD..." (Workmonitor)
 * - "..._DD-MM-YYYY_DD-MM-YYYY..." (Onvio)
 * Lanca erro se as duas datas do intervalo forem diferentes (nao da pra atribuir
 * a linha a um dia especifico) ou se nenhum padrao bater.
 */
export function extrairDataUnicaDoNomeArquivo(nomeArquivo: string): string {
  const isoComA = nomeArquivo.match(/(\d{4}-\d{2}-\d{2})_a_(\d{4}-\d{2}-\d{2})/);
  if (isoComA) {
    const [, inicio, fim] = isoComA;
    if (inicio !== fim) {
      throw new Error(
        `Arquivo "${nomeArquivo}" cobre intervalo de ${inicio} a ${fim}; ingestao so suporta exportacoes de um unico dia por arquivo.`,
      );
    }
    return inicio;
  }

  const brSemA = nomeArquivo.match(/(\d{2})-(\d{2})-(\d{4})_(\d{2})-(\d{2})-(\d{4})/);
  if (brSemA) {
    const [, d1, m1, y1, d2, m2, y2] = brSemA;
    const inicio = `${y1}-${m1}-${d1}`;
    const fim = `${y2}-${m2}-${d2}`;
    if (inicio !== fim) {
      throw new Error(
        `Arquivo "${nomeArquivo}" cobre intervalo de ${inicio} a ${fim}; ingestao so suporta exportacoes de um unico dia por arquivo.`,
      );
    }
    return inicio;
  }

  // Fallback: nomes com a 2a data truncada no download (ex.: "..._02-06-2026_02-06-202.csv")
  // nao batem no par acima. Como cada arquivo exporta 1 dia, usa a 1a data completa
  // que aparecer. So chega aqui quando NAO ha par valido (arquivos de periodo ja
  // lancaram erro no branch "_a_"), entao nao mascara intervalos reais.
  const isoUnica = nomeArquivo.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoUnica) return isoUnica[1];
  const brUnica = nomeArquivo.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (brUnica) {
    const [, d, m, y] = brUnica;
    return `${y}-${m}-${d}`;
  }

  throw new Error(`Nao foi possivel extrair a data do nome do arquivo "${nomeArquivo}".`);
}
