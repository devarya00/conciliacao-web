import * as XLSX from 'xlsx';
import { readSheetRows, pick, toNumber } from '../../../common/xlsx.util';
import { normalizeEncoding, chaveObrigacao } from '../../../common/text.util';

export interface LegendaTarefa {
  obrigacaoKey: string;
  obrigacao: string;
  classificacao: string | null;
  pontos: number;
  departamento: string | null;
}

/**
 * Parser da legenda de tarefas (CSV) - pontuacao fixa por obrigacao/tarefa,
 * usada pra somar pontos de fact_entrega no ranking. Colunas reais:
 * ID.TAREFA, CLASSIFICAÇÃO, PONTOS, DEPARTAMENTO.
 * A planilha real tem linhas duplicadas com a mesma obrigacao e pontos
 * diferentes (dado inconsistente na origem) - mesmo padrao do s3d.parser,
 * ultima linha do arquivo vence.
 */
export function parseLegendaTarefas(workbook: XLSX.WorkBook): LegendaTarefa[] {
  const rows = readSheetRows(workbook, 'legenda');

  const porChave = new Map<string, LegendaTarefa>();
  for (const row of rows) {
    const obrigacao = normalizeEncoding(pick(row, ['id.tarefa', 'id tarefa']));
    const pontos = toNumber(pick(row, ['pontos']));
    if (!obrigacao || pontos === null) continue;

    const obrigacaoKey = chaveObrigacao(obrigacao);
    porChave.set(obrigacaoKey, {
      obrigacaoKey,
      obrigacao,
      classificacao: normalizeEncoding(pick(row, ['classificacao'])) || null,
      pontos,
      departamento: normalizeEncoding(pick(row, ['departamento'])) || null,
    });
  }

  return [...porChave.values()];
}
