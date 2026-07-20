import * as XLSX from 'xlsx';
import { readSheetRows, pick, parseExcelDate } from '../../../common/xlsx.util';
import { normalizeEncoding, resolverNomeKeys } from '../../../common/text.util';

export interface OnvioSatisfacao {
  atendidoPor: string;
  nomeKey: string;
  data: string | null;
  nota: number;
}

/**
 * Escala de satisfacao do Onvio observada como texto (nao numero). Mapeamento
 * assumido em escala de 1-5; ajustar se surgirem categorias novas nos arquivos reais.
 */
const NOTA_TEXTO_PARA_NUMERO: Record<string, number> = {
  'muito insatisfeito': 1,
  insatisfeito: 2,
  neutro: 3,
  satisfeito: 4,
  'muito satisfeito': 5,
};

function converterNota(valor: any): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const texto = normalizeEncoding(String(valor)).toLowerCase();
  if (texto in NOTA_TEXTO_PARA_NUMERO) return NOTA_TEXTO_PARA_NUMERO[texto];
  const n = Number(String(valor).replace(',', '.'));
  return isNaN(n) ? null : n;
}

/**
 * Parser de estatisticas-satisfacao (Onvio) - nota de satisfacao por atendente.
 * Colunas reais: Clientes, Contato, Atendido por, Data (timestamp ISO), Nota (texto).
 * Chave de juncao: "Atendido por", tratada com nome_key (primeiro token maiusculo).
 * A planilha tem uma linha por atendimento - devolve todas (nao colapsa por
 * colaborador), pra permitir tanto contar quantos atendimentos foram avaliados
 * "muito satisfeito" (pontuacao) quanto aplicar a nota mais recente em
 * fact_produtividade (feito pelo service, ver aplicarSatisfacao).
 */
export function parseOnvioSatisfacao(workbook: XLSX.WorkBook): OnvioSatisfacao[] {
  const rows = readSheetRows(workbook, 'estatisticas-satisfa');

  const linhas = rows
    .map((row) => ({
      atendidoPor: pick(row, ['atendido por']) as string | null,
      nota: converterNota(pick(row, ['nota'])),
      data: parseExcelDate(pick(row, ['data'])),
    }))
    .filter((l): l is { atendidoPor: string; nota: number; data: string | null } => !!l.atendidoPor && l.nota !== null);

  const chaves = resolverNomeKeys(linhas.map((l) => l.atendidoPor));

  return linhas.map((l, i) => ({ atendidoPor: l.atendidoPor, nomeKey: chaves[i], data: l.data, nota: l.nota }));
}
