import { Inject, Injectable, Logger } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import * as XLSX from 'xlsx';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../db/knex.module';
import { extrairDataUnicaDoNomeArquivo, stripAccents } from '../../common/xlsx.util';
import { parseS3D } from './parsers/s3d.parser';
import { parseOnvioProdutividade } from './parsers/onvio-produtividade.parser';
import { parseOnvioSatisfacao } from './parsers/onvio-satisfacao.parser';
import { parseWorkmonitor } from './parsers/workmonitor.parser';
import { parseWorkmonitorAnalitico } from './parsers/workmonitor-analitico.parser';
import { parseLegendaTarefas } from './parsers/legenda-tarefas.parser';
import { FILE_HINTS, ORDEM_INGESTAO, Origem } from './origem';
import { ROSTER_INATIVOS, ROSTER_MERGES, ROSTER_NAO_PESSOA } from './roster-canonico';
import { EmployeeResolutionService } from './employee-resolution.service';

export interface ArquivoIngestao {
  id: number;
  nomeOriginal: string;
  caminhoArquivo: string;
  origem: Origem;
  tamanhoBytes: number | null;
  status: 'pendente' | 'processado' | 'erro';
  mensagemErro: string | null;
  enviadoEm: string;
  processadoEm: string | null;
  registros: number;
  periodoInicio: string | null;
  periodoFim: string | null;
}

export interface FiltroArquivos {
  dataInicial?: string;
  dataFinal?: string;
}

/** Postgres limita a 65535 parametros por query; margem segura por lote. */
const TAMANHO_LOTE = 2000;

/** Remove duplicatas por nomeKey, mantendo a primeira ocorrencia. */
function dedupePorChave(linhas: { nome: string; nomeKey: string }[]): { nome: string; nomeKey: string }[] {
  const vistos = new Map<string, { nome: string; nomeKey: string }>();
  for (const l of linhas) if (!vistos.has(l.nomeKey)) vistos.set(l.nomeKey, l);
  return [...vistos.values()];
}

@Injectable()
export class IngestaoService {
  private readonly logger = new Logger(IngestaoService.name);

  constructor(
    @Inject(KNEX_CONNECTION) private readonly db: Knex,
    private readonly employeeResolutionService: EmployeeResolutionService,
  ) {}

  /**
   * `colunasExcluidasDoMerge` (tipicamente `arquivo_id`) NAO entra no merge do
   * ON CONFLICT: se entrasse, reenviar um arquivo com linhas que colidem na
   * chave natural (mesmo conteudo/reenvio) rouba a posse (arquivo_id) das
   * linhas de outro arquivo_ingestao - e um DELETE (CASCADE) nesse outro
   * arquivo depois apaga dados que "vieram" de um arquivo diferente.
   */
  private async inserirEmLotes<T extends Record<string, unknown>>(
    trx: Knex.Transaction,
    tabela: string,
    rows: T[],
    conflitoColunas: string | string[],
    colunasExcluidasDoMerge: string[] = [],
    tamanhoLote = TAMANHO_LOTE,
  ): Promise<void> {
    if (rows.length === 0) return;
    const colunasParaAtualizar = Object.keys(rows[0]).filter((c) => !colunasExcluidasDoMerge.includes(c));
    for (let i = 0; i < rows.length; i += tamanhoLote) {
      const lote = rows.slice(i, i + tamanhoLote);
      await trx(tabela).insert(lote).onConflict(conflitoColunas as any).merge(colunasParaAtualizar);
    }
  }

  /** SHA-256 do conteudo do arquivo (hex) - chave de dedup por conteudo. */
  private hashArquivo(caminho: string): string {
    return createHash('sha256').update(readFileSync(caminho)).digest('hex');
  }

  /** Classifica um nome de arquivo em uma Origem pelos hints (case/acento-insensitive). Null se nao reconhecido. */
  private classificarOrigem(nomeArquivo: string): Origem | null {
    const alvo = stripAccents(nomeArquivo.toLowerCase());
    for (const [origem, hint] of Object.entries(FILE_HINTS) as [Origem, string][]) {
      if (alvo.includes(stripAccents(hint.toLowerCase()))) return origem;
    }
    return null;
  }

  /** Lista recursivamente arquivos .csv/.xlsx sob `dir`. */
  private listarArquivosRecursivo(dir: string): string[] {
    const saida: string[] = [];
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) saida.push(...this.listarArquivosRecursivo(caminho));
      else if (/\.(xlsx?|csv)$/i.test(entrada.name)) saida.push(caminho);
    }
    return saida;
  }

  /**
   * Carga em lote de TODOS os arquivos reconhecidos sob `dir` (recursivo),
   * respeitando ORDEM_INGESTAO (colaboradores antes de satisfacao) e, dentro de
   * cada origem, ordem alfabetica do nome (cronologica -> satisfacao mais recente
   * vence). Idempotente (dedup por hash de conteudo + upsert por chave natural).
   * Arquivos de "periodo" do Workmonitor (intervalo de dias) sao pulados de
   * proposito - a granularidade do painel e diaria.
   */
  async ingerirTodos(dir: string): Promise<{
    total: number;
    porOrigem: Record<string, { processado: number; pulado: number; erro: number }>;
    erros: { arquivo: string; mensagem: string }[];
  }> {
    const arquivos = this.listarArquivosRecursivo(dir)
      .map((caminho) => ({ caminho, nome: caminho.split('/').pop()!, origem: this.classificarOrigem(caminho.split('/').pop()!) }))
      .filter((a): a is { caminho: string; nome: string; origem: Origem } => a.origem !== null)
      .sort((a, b) => {
        const oa = ORDEM_INGESTAO.indexOf(a.origem);
        const ob = ORDEM_INGESTAO.indexOf(b.origem);
        return oa !== ob ? oa - ob : a.nome.localeCompare(b.nome);
      });

    const porOrigem: Record<string, { processado: number; pulado: number; erro: number }> = {};
    const erros: { arquivo: string; mensagem: string }[] = [];
    for (const origem of ORDEM_INGESTAO) porOrigem[origem] = { processado: 0, pulado: 0, erro: 0 };

    for (const a of arquivos) {
      // pula Workmonitor de periodo (nome com intervalo de datas diferentes) sem sujar como 'erro'.
      if ((a.origem === 'workmonitor' || a.origem === 'onvio_produtividade')) {
        try {
          extrairDataUnicaDoNomeArquivo(a.nome);
        } catch (err) {
          porOrigem[a.origem].pulado++;
          this.logger.warn(`Pulado (${a.origem}) ${a.nome}: ${(err as Error).message}`);
          continue;
        }
      }

      const dto = await this.ingerirArquivo({
        nomeOriginal: a.nome,
        caminhoArquivo: a.caminho,
        origem: a.origem,
        tamanhoBytes: statSync(a.caminho).size,
      });

      if (dto.status === 'erro') {
        porOrigem[a.origem].erro++;
        erros.push({ arquivo: a.nome, mensagem: dto.mensagemErro ?? 'erro desconhecido' });
      } else {
        porOrigem[a.origem].processado++;
      }
    }

    // Reaplica a identidade canonica (merges/inativos/rotulos) sobre os
    // colaboradores recem-criados por esta carga.
    await this.aplicarRosterCanonico();

    return { total: arquivos.length, porOrigem, erros };
  }

  /**
   * Aplica o roster revisado (roster-canonico.ts) sobre dim_colaborador, keyed por
   * nome_key: aponta as linhas fragmentadas da mesma pessoa para a canonica
   * (canonical_id), marca quem saiu (active_employee=false) e os rotulos de setor
   * (is_pessoa=false). Idempotente - reseta ao default antes de reaplicar, entao
   * pode rodar depois de qualquer ingestao. Nao apaga nem mescla linha nenhuma;
   * a leitura resolve pela view v_colaborador.
   */
  async aplicarRosterCanonico(): Promise<{ merges: number; inativos: number; naoPessoa: number }> {
    await this.db('dim_colaborador').update({ canonical_id: null, active_employee: true, is_pessoa: true });

    let merges = 0;
    for (const [alias, canonico] of Object.entries(ROSTER_MERGES)) {
      const canonRow = await this.db('dim_colaborador').where({ nome_key: canonico }).first();
      if (!canonRow) continue;
      merges += await this.db('dim_colaborador')
        .where({ nome_key: alias })
        .andWhereNot({ id: canonRow.id })
        .update({ canonical_id: Number(canonRow.id) });
    }

    const inativos = await this.db('dim_colaborador')
      .whereIn('nome_key', ROSTER_INATIVOS)
      .update({ active_employee: false });
    const naoPessoa = await this.db('dim_colaborador')
      .whereIn('nome_key', ROSTER_NAO_PESSOA)
      .update({ is_pessoa: false });

    this.logger.log(`roster canonico aplicado: merges=${merges} inativos=${inativos} nao_pessoa=${naoPessoa}`);
    return { merges, inativos, naoPessoa };
  }

  /**
   * Registra (se novo) e processa um arquivo unico. Usado tanto pelo upload via
   * API quanto pelo scan de pasta (executar). Idempotente: se o arquivo (mesmo
   * nome_original + origem) ja foi processado com sucesso antes, nao reprocessa.
   */
  async ingerirArquivo(input: {
    nomeOriginal: string;
    caminhoArquivo: string;
    origem: Origem;
    tamanhoBytes: number | null;
  }): Promise<ArquivoIngestao> {
    const conteudoHash = this.hashArquivo(input.caminhoArquivo);

    // Dedup por CONTEUDO: mesmos bytes ja processados (com qualquer nome) => pula.
    // Pega "... (1).csv", re-download do Teams, reenvio renomeado etc.
    const mesmoConteudo = await this.db('arquivo_ingestao')
      .whereNotNull('conteudo_hash')
      .andWhere({ conteudo_hash: conteudoHash })
      .first();
    if (mesmoConteudo && mesmoConteudo.status === 'processado') {
      return this.paraDto(mesmoConteudo);
    }

    const existente = await this.db('arquivo_ingestao')
      .where({ nome_original: input.nomeOriginal, origem: input.origem })
      .first();

    if (existente && existente.status === 'processado') {
      return this.paraDto(existente);
    }

    let arquivoId: number;
    if (existente) {
      arquivoId = Number(existente.id);
      // linha antiga (pre-hash) que vai ser reprocessada: grava o hash agora.
      if (!existente.conteudo_hash) {
        await this.db('arquivo_ingestao').where({ id: arquivoId }).update({ conteudo_hash: conteudoHash });
      }
    } else {
      try {
        const [{ id }] = await this.db('arquivo_ingestao')
          .insert({
            nome_original: input.nomeOriginal,
            caminho_arquivo: input.caminhoArquivo,
            origem: input.origem,
            tamanho_bytes: input.tamanhoBytes,
            conteudo_hash: conteudoHash,
            status: 'pendente',
          })
          .returning('id');
        arquivoId = Number(id);
      } catch (err) {
        // corrida perdida por UNIQUE (nome_original+origem OU conteudo_hash) - usa
        // a linha vencedora em vez de estourar 500.
        if ((err as { code?: string }).code !== '23505') throw err;
        const concorrente = await this.db('arquivo_ingestao')
          .where({ nome_original: input.nomeOriginal, origem: input.origem })
          .orWhere({ conteudo_hash: conteudoHash })
          .first();
        if (!concorrente) throw err;
        if (concorrente.status === 'processado') return this.paraDto(concorrente);
        arquivoId = Number(concorrente.id);
      }
    }

    try {
      await this.db.transaction((trx) =>
        this.processarPorOrigem(trx, input.origem, input.caminhoArquivo, input.nomeOriginal, arquivoId),
      );
      const [row] = await this.db('arquivo_ingestao')
        .where({ id: arquivoId })
        .update({ status: 'processado', processado_em: this.db.fn.now(), mensagem_erro: null })
        .returning('*');
      this.logger.log(`Arquivo ${input.nomeOriginal} (${input.origem}) processado.`);
      return this.paraDto(row);
    } catch (err) {
      const mensagem = (err as Error).message;
      const [row] = await this.db('arquivo_ingestao')
        .where({ id: arquivoId })
        .update({ status: 'erro', mensagem_erro: mensagem })
        .returning('*');
      this.logger.error(`Falha ao processar ${input.nomeOriginal}: ${mensagem}`);
      return this.paraDto(row);
    }
  }

  /** Varre INGESTAO_DIR e ingere (idempotentemente) qualquer arquivo reconhecido pelos hints. */
  async executar(dir = process.env.INGESTAO_DIR || './data'): Promise<void> {
    let files: string[] = [];
    try {
      files = readdirSync(dir);
    } catch {
      this.logger.warn(`Diretorio de ingestao nao encontrado: ${dir}`);
      return;
    }

    for (const [origem, hint] of Object.entries(FILE_HINTS) as [Origem, string][]) {
      const nome = files.find((f) => f.toLowerCase().includes(hint) && /\.(xlsx?|csv)$/i.test(f));
      if (!nome) continue;
      const caminho = join(dir, nome);
      await this.ingerirArquivo({
        nomeOriginal: nome,
        caminhoArquivo: caminho,
        origem,
        tamanhoBytes: statSync(caminho).size,
      });
    }
  }

  async listar(filtro: FiltroArquivos = {}): Promise<ArquivoIngestao[]> {
    const arquivos = await this.db('arquivo_ingestao').select('*').orderBy('enviado_em', 'desc');
    const contagens = await this.contarRegistrosPorArquivo();
    const periodos = await this.periodosPorArquivo();
    let dtos = arquivos.map((a) =>
      this.paraDto(a, contagens.get(Number(a.id)) ?? 0, periodos.get(Number(a.id)) ?? this.periodoPeloNomeArquivo(a.nome_original)),
    );

    if (filtro.dataInicial || filtro.dataFinal) {
      dtos = dtos.filter((d) => {
        if (!d.periodoInicio || !d.periodoFim) return false;
        if (filtro.dataInicial && d.periodoFim < filtro.dataInicial) return false;
        if (filtro.dataFinal && d.periodoInicio > filtro.dataFinal) return false;
        return true;
      });
    }
    return dtos;
  }

  async buscar(id: number): Promise<ArquivoIngestao | null> {
    const row = await this.db('arquivo_ingestao').where({ id }).first();
    return row ? this.paraDto(row) : null;
  }

  /**
   * Fallback quando o arquivo nao tem nenhuma linha com data em fact_* ligada a
   * ele (caso do onvio_satisfacao - so atualiza a nota, sem grao de data
   * proprio). O nome do arquivo sempre exporta 1 dia so, no padrao
   * "..._DD-MM-YYYY_DD-MM-YYYY..." ou "..._YYYY-MM-DD_a_YYYY-MM-DD...", entao
   * da pra extrair o periodo dali mesmo sem passar pelas facts.
   */
  private periodoPeloNomeArquivo(nomeOriginal: string): { inicio: string; fim: string } | null {
    try {
      const data = extrairDataUnicaDoNomeArquivo(nomeOriginal);
      return { inicio: data, fim: data };
    } catch {
      return null;
    }
  }

  /**
   * Periodo real dos dados de cada arquivo (nao a data de upload) - min/max da
   * coluna de data de cada fact ligada ao arquivo. s3d usa a mesma DATA_MESTRE
   * (COALESCE data_entrega/prazo_tecnico) do resto do dashboard. Arquivos sem
   * data propria por linha (legenda_tarefas, onvio_satisfacao - so atualiza
   * satisfacao, sem grao de data) ficam de fora do map (periodo null).
   */
  private async periodosPorArquivo(): Promise<Map<number, { inicio: string; fim: string }>> {
    const periodos = new Map<number, { inicio: string; fim: string }>();
    const fontes: { tabela: string; coluna: string; expressaoData: string }[] = [
      { tabela: 'fact_entrega', coluna: 'arquivo_id', expressaoData: 'COALESCE(data_entrega, prazo_tecnico)' },
      { tabela: 'fact_produtividade', coluna: 'arquivo_id', expressaoData: 'data' },
      { tabela: 'fact_performance', coluna: 'arquivo_id', expressaoData: 'data' },
      { tabela: 'fact_jornada', coluna: 'arquivo_id', expressaoData: 'data' },
    ];

    for (const { tabela, coluna, expressaoData } of fontes) {
      const rows = await this.db(tabela)
        .select(this.db.raw(`${coluna} as arquivo_id, min(${expressaoData}) as inicio, max(${expressaoData}) as fim`))
        .whereNotNull(coluna)
        .whereRaw(`${expressaoData} IS NOT NULL`)
        .groupBy(coluna);

      for (const r of rows as any[]) {
        periodos.set(Number(r.arquivo_id), {
          inicio: r.inicio instanceof Date ? r.inicio.toISOString().slice(0, 10) : r.inicio,
          fim: r.fim instanceof Date ? r.fim.toISOString().slice(0, 10) : r.fim,
        });
      }
    }
    return periodos;
  }

  /** Remove o arquivo (DB via CASCADE/trigger limpam os dados derivados) e o arquivo fisico em disco. */
  async remover(id: number): Promise<void> {
    const arquivo = await this.db('arquivo_ingestao').where({ id }).first();
    if (!arquivo) return;

    await this.db('arquivo_ingestao').where({ id }).delete();

    try {
      if (existsSync(arquivo.caminho_arquivo)) unlinkSync(arquivo.caminho_arquivo);
    } catch (err) {
      this.logger.warn(`Nao foi possivel remover arquivo fisico ${arquivo.caminho_arquivo}: ${(err as Error).message}`);
    }
  }

  private async contarRegistrosPorArquivo(): Promise<Map<number, number>> {
    const contagens = new Map<number, number>();
    const tabelasPorColuna: [string, string][] = [
      ['fact_entrega', 'arquivo_id'],
      ['fact_produtividade', 'arquivo_id'],
      ['fact_performance', 'arquivo_id'],
      ['fact_produtividade', 'satisfacao_arquivo_id'],
      ['fact_atendimento', 'arquivo_id'],
      ['fact_jornada', 'arquivo_id'],
      ['dim_tarefa_pontos', 'arquivo_id'],
    ];

    for (const [tabela, coluna] of tabelasPorColuna) {
      const rows = await this.db(tabela)
        .whereNotNull(coluna)
        .groupBy(coluna)
        .select({ arquivoId: coluna })
        .count({ total: '*' });
      for (const r of rows as any[]) {
        const id = Number(r.arquivoId);
        contagens.set(id, (contagens.get(id) ?? 0) + Number(r.total));
      }
    }
    return contagens;
  }

  private async processarPorOrigem(
    trx: Knex.Transaction,
    origem: Origem,
    caminho: string,
    nomeOriginal: string,
    arquivoId: number,
  ) {
    const workbook = XLSX.readFile(caminho);

    switch (origem) {
      case 's3d': {
        const { empresas, entregas } = parseS3D(workbook);
        await this.upsertEmpresas(trx, empresas);
        const colaboradores = dedupePorChave(
          entregas
            .filter((e) => e.colaboradorKey && e.colaboradorNome)
            .map((e) => ({ nome: e.colaboradorNome!, nomeKey: e.colaboradorKey! })),
        );
        const mapaColaboradores = await this.upsertColaboradores(trx, colaboradores);
        await this.upsertEntregas(trx, entregas, mapaColaboradores, arquivoId);
        return;
      }
      case 'legenda_tarefas': {
        const linhas = parseLegendaTarefas(workbook);
        await this.upsertTarefaPontos(trx, linhas, arquivoId);
        return;
      }
      case 'onvio_produtividade': {
        const linhas = parseOnvioProdutividade(workbook, nomeOriginal);
        const mapa = await this.upsertColaboradores(trx, linhas);
        await this.upsertProdutividade(trx, linhas, mapa, arquivoId);
        return;
      }
      case 'onvio_satisfacao': {
        const linhas = parseOnvioSatisfacao(workbook);
        const mapa = await this.mapaColaboradores(trx);
        await this.aplicarSatisfacao(trx, linhas, mapa, arquivoId);
        return;
      }
      case 'workmonitor': {
        const linhas = parseWorkmonitor(workbook, nomeOriginal);
        await this.upsertPerformanceComResolucao(trx, linhas, arquivoId, nomeOriginal);
        return;
      }
      case 'workmonitor_analitico': {
        const linhas = parseWorkmonitorAnalitico(workbook);
        const mapa = await this.upsertColaboradores(trx, linhas);
        await this.upsertJornada(trx, linhas, mapa, arquivoId);
        return;
      }
    }
  }

  private async upsertJornada(
    trx: Knex.Transaction,
    linhas: ReturnType<typeof parseWorkmonitorAnalitico>,
    colaboradorIdPorKey: Map<string, number>,
    arquivoId: number,
  ) {
    const rows = linhas
      .map((l) => {
        const colaboradorId = colaboradorIdPorKey.get(l.nomeKey);
        if (!colaboradorId) return null;
        return {
          colaborador_id: colaboradorId,
          data: l.data,
          atividades_s: l.atividadesS,
          jornada_aferida_s: l.jornadaAferidaS,
          jornada_cadastrada_s: l.jornadaCadastradaS,
          entrada: l.entrada,
          saida: l.saida,
          arquivo_id: arquivoId,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) return;
    await this.inserirEmLotes(trx, 'fact_jornada', rows, ['colaborador_id', 'data'], ['arquivo_id']);
  }

  private async upsertEmpresas(trx: Knex.Transaction, empresas: ReturnType<typeof parseS3D>['empresas']) {
    if (empresas.length === 0) return;
    const rows = empresas.map((e) => ({
      emp_id: e.empId,
      cnpj: e.cnpj,
      razao_social: e.razaoSocial,
      cidade: e.cidade,
      estado: e.estado,
    }));
    await this.inserirEmLotes(trx, 'dim_empresa', rows, 'emp_id');
  }

  private async upsertEntregas(
    trx: Knex.Transaction,
    entregas: ReturnType<typeof parseS3D>['entregas'],
    colaboradorIdPorKey: Map<string, number>,
    arquivoId: number,
  ) {
    if (entregas.length === 0) return;
    const rows = entregas.map((e) => ({
      emp_id: e.empId,
      obrigacao: e.obrigacao,
      tipo: e.tipo,
      status: e.status,
      status_class: e.statusClass,
      is_reinf: e.isReinf,
      departamento: e.departamento,
      data_entrega: e.dataEntrega,
      prazo_tecnico: e.prazoTecnico,
      competencia: e.competencia,
      ocorrencia: e.ocorrencia,
      colaborador_id: e.colaboradorKey ? colaboradorIdPorKey.get(e.colaboradorKey) ?? null : null,
      arquivo_id: arquivoId,
    }));
    await this.inserirEmLotes(trx, 'fact_entrega', rows, ['emp_id', 'obrigacao', 'competencia', 'ocorrencia'], ['arquivo_id']);
  }

  private async upsertTarefaPontos(
    trx: Knex.Transaction,
    linhas: ReturnType<typeof parseLegendaTarefas>,
    arquivoId: number,
  ) {
    if (linhas.length === 0) return;
    const rows = linhas.map((l) => ({
      obrigacao_key: l.obrigacaoKey,
      obrigacao: l.obrigacao,
      classificacao: l.classificacao,
      pontos: l.pontos,
      departamento: l.departamento,
      arquivo_id: arquivoId,
    }));
    await this.inserirEmLotes(trx, 'dim_tarefa_pontos', rows, 'obrigacao_key');
  }

  private async mapaColaboradores(trx: Knex.Transaction): Promise<Map<string, number>> {
    const rows = await trx('dim_colaborador').select('id', 'nome_key');
    return new Map(rows.map((r: any) => [r.nome_key, Number(r.id)]));
  }

  private async upsertColaboradores(
    trx: Knex.Transaction,
    linhas: { nome: string; nomeKey: string }[],
  ): Promise<Map<string, number>> {
    const mapaAtual = await this.mapaColaboradores(trx);
    const novos = new Map<string, string>();
    for (const l of linhas) {
      if (!mapaAtual.has(l.nomeKey)) novos.set(l.nomeKey, l.nome);
    }
    if (novos.size === 0) return mapaAtual;

    const entradas = [...novos.entries()].map(([nomeKey, nome]) => ({ nome, nome_key: nomeKey }));
    const atualizado = new Map(mapaAtual);
    for (let i = 0; i < entradas.length; i += TAMANHO_LOTE) {
      const lote = entradas.slice(i, i + TAMANHO_LOTE);
      const inseridos = await trx('dim_colaborador')
        .insert(lote)
        .onConflict('nome_key')
        .merge()
        .returning(['id', 'nome_key']);
      for (const row of inseridos) atualizado.set(row.nome_key, Number(row.id));
    }
    return atualizado;
  }

  private async upsertProdutividade(
    trx: Knex.Transaction,
    linhas: ReturnType<typeof parseOnvioProdutividade>,
    colaboradorIdPorKey: Map<string, number>,
    arquivoId: number,
  ) {
    const rows = linhas
      .map((l) => {
        const colaboradorId = colaboradorIdPorKey.get(l.nomeKey);
        if (!colaboradorId) return null;
        return {
          colaborador_id: colaboradorId,
          data: l.data,
          concluidos: l.concluidos,
          iniciados: l.iniciados,
          tempo_medio_s: l.tempoMedioS,
          abertos: l.abertos,
          desconsiderados: l.desconsiderados,
          arquivo_id: arquivoId,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) return;
    await this.inserirEmLotes(trx, 'fact_produtividade', rows, ['colaborador_id', 'data'], ['arquivo_id']);
  }

  /**
   * Workmonitor nao tem coluna de departamento - nome ja conhecido via nome_key
   * (mesma pessoa ja mesclada de Onvio/S3D) grava direto. Nome NOVO (nome_key
   * sem match) e exatamente o caso "Lisamara" x "Lisa dp fiscal": nao da pra
   * saber o departamento so pelo Workmonitor, entao nunca adivinha - vai pra
   * ingestion_review_queue (via EmployeeResolutionService.resolve com rawDept
   * vazio) com o payload da linha, esperando aprovacao manual do admin.
   */
  private async upsertPerformanceComResolucao(
    trx: Knex.Transaction,
    linhas: ReturnType<typeof parseWorkmonitor>,
    arquivoId: number,
    nomeOriginal: string,
  ) {
    const conhecidos = await trx('dim_colaborador').select('id', 'nome_key');
    const mapaConhecidos = new Map(conhecidos.map((r: any) => [r.nome_key, Number(r.id)]));

    const rows: Record<string, unknown>[] = [];
    let exact = 0;
    let fuzzy = 0;
    let unresolved = 0;

    for (const l of linhas) {
      const payload = {
        data: l.data,
        produtivo_s: l.produtivoS,
        neutro_s: l.neutroS,
        improdutivo_s: l.improdutivoS,
        ocio_s: l.ocioS,
        jornada_s: l.jornadaS,
        score_genia: l.scoreGenia,
        alertas: l.alertas,
        arquivo_id: arquivoId,
      };

      const colaboradorIdConhecido = mapaConhecidos.get(l.nomeKey);
      if (colaboradorIdConhecido) {
        rows.push({ colaborador_id: colaboradorIdConhecido, ...payload });
        exact++;
        continue;
      }

      const resultado = await this.employeeResolutionService.resolve(l.nome, '', nomeOriginal, payload, trx);
      if (resultado.matchType === 'unresolved') {
        unresolved++;
      } else {
        if (resultado.matchType === 'fuzzy') fuzzy++;
        else exact++;
        rows.push({ colaborador_id: resultado.employeeId, ...payload });
      }
    }

    if (rows.length > 0) {
      await this.inserirEmLotes(trx, 'fact_performance', rows, ['colaborador_id', 'data'], ['arquivo_id']);
    }
    this.logger.log(`workmonitor ${nomeOriginal}: exact=${exact} fuzzy=${fuzzy} unresolved=${unresolved}`);
  }

  /**
   * estatisticas-satisfacao tem uma linha por atendimento avaliado. Grava cada
   * uma em fact_atendimento (base p/ contar quantos foram "muito satisfeito" e
   * pontuar) e, separadamente, aplica so a nota mais recente de cada colaborador
   * em todas as linhas de fact_produtividade (nao tem grao diario declarado no
   * doc), marcando satisfacao_arquivo_id para permitir reverter ao excluir o arquivo.
   */
  private async aplicarSatisfacao(
    trx: Knex.Transaction,
    linhas: ReturnType<typeof parseOnvioSatisfacao>,
    colaboradorIdPorKey: Map<string, number>,
    arquivoId: number,
  ) {
    const atendimentos = linhas
      .map((l) => {
        const colaboradorId = colaboradorIdPorKey.get(l.nomeKey);
        if (!colaboradorId || !l.data) return null;
        return { colaborador_id: colaboradorId, data: l.data, nota: l.nota, arquivo_id: arquivoId };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (atendimentos.length > 0) {
      for (let i = 0; i < atendimentos.length; i += TAMANHO_LOTE) {
        await trx('fact_atendimento').insert(atendimentos.slice(i, i + TAMANHO_LOTE));
      }
    }

    const maisRecentePorColaborador = new Map<number, { data: string | null; nota: number }>();
    for (const l of linhas) {
      const colaboradorId = colaboradorIdPorKey.get(l.nomeKey);
      if (!colaboradorId) continue;
      const atual = maisRecentePorColaborador.get(colaboradorId);
      if (!atual || (l.data && (!atual.data || l.data > atual.data))) {
        maisRecentePorColaborador.set(colaboradorId, { data: l.data, nota: l.nota });
      }
    }

    for (const [colaboradorId, { nota }] of maisRecentePorColaborador) {
      await trx('fact_produtividade')
        .where({ colaborador_id: colaboradorId })
        .update({ satisfacao: nota, satisfacao_arquivo_id: arquivoId });
    }
  }

  private paraDto(row: any, registros = 0, periodo: { inicio: string; fim: string } | null = null): ArquivoIngestao {
    return {
      id: Number(row.id),
      nomeOriginal: row.nome_original,
      caminhoArquivo: row.caminho_arquivo,
      origem: row.origem,
      tamanhoBytes: row.tamanho_bytes !== null ? Number(row.tamanho_bytes) : null,
      status: row.status,
      mensagemErro: row.mensagem_erro,
      enviadoEm: row.enviado_em instanceof Date ? row.enviado_em.toISOString() : row.enviado_em,
      processadoEm: row.processado_em
        ? row.processado_em instanceof Date
          ? row.processado_em.toISOString()
          : row.processado_em
        : null,
      registros,
      periodoInicio: periodo?.inicio ?? null,
      periodoFim: periodo?.fim ?? null,
    };
  }
}
