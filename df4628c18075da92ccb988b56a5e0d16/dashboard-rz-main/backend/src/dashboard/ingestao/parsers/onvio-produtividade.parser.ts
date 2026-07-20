import * as XLSX from 'xlsx';
import { readSheetRows, pick, toNumber, parseHms, extrairDataUnicaDoNomeArquivo, stripAccents } from '../../../common/xlsx.util';
import { normalizeEncoding, resolverNomeKeys } from '../../../common/text.util';

export interface OnvioProdutividade {
  nome: string;
  nomeKey: string;
  data: string;
  concluidos: number;
  iniciados: number;
  tempoMedioS: number | null;
  abertos: number;
  desconsiderados: number;
}

/** Departamentos conhecidos que aparecem colados ao nome (ver limparNomeDepartamento). */
const DEPARTAMENTOS_CONHECIDOS = ['fiscal', 'pessoal', 'contabil', 'comercial', 'administrativo', 'societario', 'bpo'];

/**
 * "Nome" desta planilha vem sujo com o departamento: "Danielly - Pessoal",
 * "Diana - Fiscal/Contabil", "Maria Clara Fiscal/Contabil" (sem hifen!), ou
 * limpo mesmo: "Vitor Rezende". Remove o sufixo de departamento preservando
 * pelo menos os 2 primeiros tokens (nome/sobrenome).
 */
function limparNomeDepartamento(nomeBruto: string): string {
  const clean = normalizeEncoding(nomeBruto);
  const [antesDoHifen] = clean.split(/\s+-\s+/);
  if (antesDoHifen !== clean) return antesDoHifen.trim();

  const tokens = clean.split(/\s+/);
  const idxDepartamento = tokens.findIndex((t, i) => {
    if (i < 2) return false;
    return t.includes('/') || DEPARTAMENTOS_CONHECIDOS.some((d) => stripAccents(t.toLowerCase()).startsWith(d));
  });
  if (idxDepartamento === -1) return clean;
  return tokens.slice(0, idxDepartamento).join(' ');
}

/**
 * Parser de estatisticas-funcionarios (Onvio) - produtividade por colaborador.
 * Colunas reais: Nome, Tempo medio, Abertos, Iniciados, Concluidos, Desconsiderados, Satisfacao.
 * "Satisfacao" desta planilha e ignorada de proposito - o doc define a nota de
 * satisfacao como vinda exclusivamente da planilha estatisticas-satisfacao (chave
 * "Atendido por"), que tem ingestao e arquivo_id proprios.
 * Sem coluna de data - extraida do nome do arquivo (1 dia por export, ver
 * extrairDataUnicaDoNomeArquivo).
 */
export function parseOnvioProdutividade(workbook: XLSX.WorkBook, nomeArquivo: string): OnvioProdutividade[] {
  const data = extrairDataUnicaDoNomeArquivo(nomeArquivo);
  const rows = readSheetRows(workbook, 'estatisticas-funcionarios');

  const nomes: string[] = [];
  const linhasBase = rows
    .map((row) => {
      const nomeBruto = pick(row, ['nome']);
      if (!nomeBruto) return null;
      const nome = limparNomeDepartamento(nomeBruto);
      nomes.push(nome);
      return {
        nome,
        concluidos: toNumber(pick(row, ['concluidos'])) ?? 0,
        iniciados: toNumber(pick(row, ['iniciados'])) ?? 0,
        tempoMedioS: parseHms(pick(row, ['tempo medio'])),
        abertos: toNumber(pick(row, ['abertos'])) ?? 0,
        desconsiderados: toNumber(pick(row, ['desconsiderados'])) ?? 0,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const chaves = resolverNomeKeys(nomes);
  return linhasBase.map((linha, i) => ({ ...linha, nomeKey: chaves[i], data }));
}
