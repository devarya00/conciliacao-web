import * as XLSX from 'xlsx';
import { readSheetRows, pick, toNumber, extrairDataUnicaDoNomeArquivo } from '../../../common/xlsx.util';
import { resolverNomeKeys } from '../../../common/text.util';

export interface WorkmonitorPerformance {
  nome: string;
  nomeKey: string;
  data: string;
  produtivoS: number;
  neutroS: number;
  improdutivoS: number;
  ocioS: number;
  jornadaS: number;
  scoreGenia: number | null;
  alertas: number;
}

/**
 * Parser de Workmonitor_performance - score de performance (score_genia), produtivo/ocio.
 * Colunas reais: id, id_aux_1, id_aux_2, Nome, dias_com_atividade, jornada_esperada_segs,
 * total_atividades_segs, total_produtivo_segs, total_neutro_segs, total_improdutivo_segs,
 * total_ocio_segs, alertas_comportamentais, alertas_bloqueios, alertas_acesso, score_genia.
 * Chave de merge com Onvio: primeiro nome em maiusculas (nome_key).
 */
export function parseWorkmonitor(workbook: XLSX.WorkBook, nomeArquivo: string): WorkmonitorPerformance[] {
  const data = extrairDataUnicaDoNomeArquivo(nomeArquivo);
  const rows = readSheetRows(workbook, 'Workmonitor_performance');

  const nomes: string[] = [];
  const linhasBase = rows
    .map((row) => {
      const nome = pick(row, ['nome']);
      if (!nome) return null;
      nomes.push(nome);

      const alertas =
        (toNumber(pick(row, ['alertas_comportamentais'])) ?? 0) +
        (toNumber(pick(row, ['alertas_bloqueios'])) ?? 0) +
        (toNumber(pick(row, ['alertas_acesso'])) ?? 0);

      return {
        nome,
        produtivoS: toNumber(pick(row, ['total_produtivo_segs'])) ?? 0,
        neutroS: toNumber(pick(row, ['total_neutro_segs'])) ?? 0,
        improdutivoS: toNumber(pick(row, ['total_improdutivo_segs'])) ?? 0,
        ocioS: toNumber(pick(row, ['total_ocio_segs'])) ?? 0,
        jornadaS: toNumber(pick(row, ['jornada_esperada_segs'])) ?? 0,
        scoreGenia: toNumber(pick(row, ['score_genia'])),
        alertas,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const chaves = resolverNomeKeys(nomes);
  return linhasBase.map((linha, i) => ({ ...linha, nomeKey: chaves[i], data }));
}
