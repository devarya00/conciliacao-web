import * as XLSX from 'xlsx';
import { readSheetRows, pick, toNumber, parseHms, extrairDataUnicaDoNomeArquivo, stripAccents } from '../../../common/xlsx.util';
import { normalizeEncoding, resolverNomeKeys } from '../../../common/text.util';

export interface OnvioProdutividade {
  nome: string;
  nomeKey: string;
  departamento: string | null;
  data: string;
  concluidos: number;
  iniciados: number;
  tempoMedioS: number | null;
  abertos: number;
  desconsiderados: number;
}

/** Departamentos conhecidos que aparecem colados ao nome (ver separarNomeDepartamento). */
const DEPARTAMENTOS_CONHECIDOS = ['fiscal', 'pessoal', 'contabil', 'comercial', 'administrativo', 'societario', 'bpo'];

/** Grafia canonica (igual ao rotulo usado no S3D/filtro do dashboard) por token reconhecido. */
const ROTULO_DEPARTAMENTO: Record<string, string> = {
  fiscal: 'Fiscal',
  pessoal: 'Pessoal',
  contabil: 'Contábil',
  comercial: 'Comercial',
  administrativo: 'Dep Administrativo',
  societario: 'Societário',
  bpo: 'BPO-Assertivo',
};

/**
 * "Nome" desta planilha vem sujo com o departamento: "Danielly - Pessoal",
 * "Diana - Fiscal/Contabil", "Maria Clara Fiscal/Contabil" (sem hifen!), ou
 * limpo mesmo: "Vitor Rezende". Separa o nome limpo (preservando pelo menos os
 * 2 primeiros tokens) do rotulo de departamento - quando composto
 * ("Fiscal/Contabil"), guarda só o primeiro como departamento primário (mesmo
 * formato de rótulo único que fact_entrega/S3D já usa).
 */
function separarNomeDepartamento(nomeBruto: string): { nome: string; departamento: string | null } {
  const clean = normalizeEncoding(nomeBruto);

  const [antesDoHifen, depoisDoHifen] = clean.split(/\s+-\s+/);
  let nome: string;
  let bruto: string | null;

  if (antesDoHifen !== clean) {
    nome = antesDoHifen.trim();
    bruto = depoisDoHifen?.trim() ?? null;
  } else {
    const tokens = clean.split(/\s+/);
    const idx = tokens.findIndex((t, i) => {
      if (i < 2) return false;
      return t.includes('/') || DEPARTAMENTOS_CONHECIDOS.some((d) => stripAccents(t.toLowerCase()).startsWith(d));
    });
    nome = idx === -1 ? clean : tokens.slice(0, idx).join(' ');
    bruto = idx === -1 ? null : tokens.slice(idx).join(' ');
  }

  if (!bruto) return { nome, departamento: null };
  const primeiroToken = bruto.split('/')[0].trim();
  const chave = DEPARTAMENTOS_CONHECIDOS.find((d) => stripAccents(primeiroToken.toLowerCase()).startsWith(d));
  return { nome, departamento: chave ? ROTULO_DEPARTAMENTO[chave] : primeiroToken };
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
      const { nome, departamento } = separarNomeDepartamento(nomeBruto);
      nomes.push(nome);
      return {
        nome,
        departamento,
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
