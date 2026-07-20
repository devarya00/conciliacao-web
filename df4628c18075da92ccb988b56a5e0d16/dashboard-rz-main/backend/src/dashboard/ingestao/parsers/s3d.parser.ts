import * as XLSX from 'xlsx';
import { readSheetRows, pick, parseExcelDate, parseCompetencia } from '../../../common/xlsx.util';
import { classifyStatus, isReinf, normalizeEncoding, resolverNomeKeys } from '../../../common/text.util';

export interface S3DEmpresa {
  empId: number;
  cnpj: string | null;
  razaoSocial: string | null;
  cidade: string | null;
  estado: string | null;
}

export interface S3DEntrega {
  empId: number;
  obrigacao: string;
  tipo: string | null;
  status: string;
  statusClass: string;
  isReinf: boolean;
  departamento: string | null; // coluna "Departamento" (Fiscal, Pessoal, Contabil, ...)
  dataEntrega: string | null;
  prazoTecnico: string | null;
  competencia: string | null;
  ocorrencia: number; // 1..N: indice da repeticao da chave (empId, obrigacao, competencia) na ordem do arquivo
  colaboradorNome: string | null; // preenchido so quando Responsavel prazo === Responsavel entrega (mesma pessoa)
  colaboradorKey: string | null;
}

/**
 * Parser da S3D_gestao_de_entregas (Acessorias) - base mestre de tarefas/obrigacoes.
 * Colunas reais: Obrigacao, Tipo, Empresa, EmpID, CNPJ, Cidade, Estado, Prazo legal,
 * Prazo Tecnico, Data da entrega, Status, Departamento, Responsavel prazo,
 * Responsavel entrega, Competencia, Protocolo.
 *
 * "Departamento" ja vem como rotulo curto (Fiscal/Pessoal/Contabil/...) e e o que
 * alimenta fact_entrega.departamento. "Responsavel prazo"/"Responsavel entrega"
 * agora trazem nome de pessoa (antes traziam so rotulo de departamento) - so
 * credita a tarefa a um colaborador quando as duas colunas apontam pro mesmo
 * nome (nome_key), evitando creditar errado quando prazo e entrega tem
 * responsaveis diferentes.
 * "Competencia" vem como "dez/25", "jan/26" etc (mes abreviado pt-BR + ano de 2 digitos).
 */
export function parseS3D(workbook: XLSX.WorkBook): { empresas: S3DEmpresa[]; entregas: S3DEntrega[] } {
  const rows = readSheetRows(workbook, 'S3D_gestao_de_entregas');

  const empresasPorId = new Map<number, S3DEmpresa>();

  const responsaveisPrazo = rows.map((row) => normalizeEncoding(pick(row, ['responsavel prazo'])) || null);
  const responsaveisEntrega = rows.map((row) => normalizeEncoding(pick(row, ['responsavel entrega'])) || null);

  // Compara nome completo (nao nome_key) pra decidir "mesma pessoa": nome_key e so
  // o 1o token, e resolver colisao por coluna separadamente (prazo x entrega) deixa
  // passar falso-positivo quando duas pessoas diferentes tem o mesmo primeiro nome
  // (ex.: "Vitor Rezende" no prazo x "Vitor Hugo" na entrega colidiam em "VITOR").
  const comparavel = (nome: string | null) => (nome ? nome.toUpperCase().replace(/\s+/g, ' ').trim() : null);
  const mesmaPessoaPorLinha = rows.map((_, i) => {
    const p = comparavel(responsaveisPrazo[i]);
    const e = comparavel(responsaveisEntrega[i]);
    return !!p && !!e && p === e;
  });

  // nome_key so precisa ser colisao-segura dentro do pool de pessoas realmente
  // creditadas (linhas onde prazo === entrega) - resolve so sobre essas.
  const nomesCreditados = rows.map((_, i) => (mesmaPessoaPorLinha[i] ? responsaveisEntrega[i] : null));
  const chavesCreditadas = resolverNomeKeys(nomesCreditados);

  // planilha real repete a mesma obrigacao/competencia tanto por reenvio
  // (atualizacao de status) quanto por execucao diaria de tarefa recorrente -
  // guarda TODAS as linhas, numerando cada repeticao da chave (ocorrencia) na
  // ordem do arquivo. Deduplicar e decisao de leitura (v_entrega_dedup).
  const entregas: S3DEntrega[] = [];
  const ocorrenciaPorChave = new Map<string, number>();

  rows.forEach((row, i) => {
    const empId = toInt(pick(row, ['empid']));
    if (empId === null) return;

    if (!empresasPorId.has(empId)) {
      empresasPorId.set(empId, {
        empId,
        cnpj: pick(row, ['cnpj']) ?? null,
        razaoSocial: normalizeEncoding(pick(row, ['empresa'])) || null,
        cidade: pick(row, ['cidade']) ?? null,
        estado: pick(row, ['estado']) ?? null,
      });
    }

    const obrigacao = normalizeEncoding(pick(row, ['obrigacao / tarefa', 'obrigacao/tarefa', 'obrigacao']));
    const status = normalizeEncoding(pick(row, ['status']));
    const competencia = parseCompetencia(pick(row, ['competencia']));

    const mesmaPessoa = mesmaPessoaPorLinha[i];
    const chaveEntrega = chavesCreditadas[i];

    const chave = `${empId}|${obrigacao}|${competencia}`;
    const ocorrencia = (ocorrenciaPorChave.get(chave) ?? 0) + 1;
    ocorrenciaPorChave.set(chave, ocorrencia);

    entregas.push({
      empId,
      obrigacao,
      tipo: pick(row, ['tipo']) ?? null,
      status,
      statusClass: classifyStatus(status),
      isReinf: isReinf(obrigacao),
      departamento: normalizeEncoding(pick(row, ['departamento'])) || null,
      dataEntrega: parseExcelDate(pick(row, ['data da entrega'])),
      prazoTecnico: parseExcelDate(pick(row, ['prazo tecnico'])),
      competencia,
      ocorrencia,
      colaboradorNome: mesmaPessoa ? responsaveisEntrega[i] : null,
      colaboradorKey: mesmaPessoa ? chaveEntrega : null,
    });
  });

  return { empresas: [...empresasPorId.values()], entregas };
}

function toInt(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = parseInt(String(value), 10);
  return isNaN(n) ? null : n;
}
