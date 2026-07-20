import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../db/knex.module';
import { AliasEntry, ResolutionResult, matchAlias, normalizeAliasText, tokenSortRatio } from './employee-resolution.util';

export interface ReviewQueueGrupo {
  id: number; // menor id do grupo - usado em approve/reject
  rawName: string;
  rawDept: string;
  sourceFiles: string[];
  pendentes: number;
  criadoEm: string;
}

export interface SugestaoColaborador {
  employeeId: number;
  canonicalName: string;
  score: number;
}

export interface ResultadoAprovacao {
  employeeId: number;
  canonicalName: string;
  linhasAprovadas: number;
}

/**
 * Reconcilia nomes divergentes entre planilhas de desempenho (ex.: "Lisamara"
 * vs "Lisa dp fiscal") contra dim_colaborador via employee_alias. Linhas
 * unresolved NAO entram em fact_performance - vao para ingestion_review_queue
 * ate um alias ser aprovado manualmente (aprovarAlias).
 */
@Injectable()
export class EmployeeResolutionService {
  private cache: AliasEntry[] | null = null;

  constructor(@Inject(KNEX_CONNECTION) private readonly db: Knex) {}

  /** Invalida o cache em memoria - proxima resolve() recarrega de employee_alias. */
  invalidateCache(): void {
    this.cache = null;
  }

  private async carregarCache(executor: Knex | Knex.Transaction): Promise<AliasEntry[]> {
    if (this.cache) return this.cache;

    const linhas = await executor('employee_alias as ea')
      .join('dim_colaborador as dc', 'dc.id', 'ea.colaborador_id')
      .select(
        'ea.departamento_normalizado as departamentoNormalizado',
        'ea.alias_normalizado as aliasNormalizado',
        'ea.colaborador_id as colaboradorId',
        'dc.nome as canonicalName',
      );

    this.cache = (linhas as any[]).map((l) => ({ ...l, colaboradorId: Number(l.colaboradorId) }));
    return this.cache;
  }

  /**
   * Resolve rawName/rawDept contra o cache de aliases (exato -> fuzzy -> unresolved).
   * rawDept vazio/desconhecido NUNCA tenta match - vai direto pra fila (sem
   * departamento nao da pra garantir que nao colapsa gente de setor diferente).
   * `payload`, quando dado, e gravado junto na fila (unresolved) pra permitir
   * reprocessar a linha (ex.: gravar em fact_performance) quando for aprovada,
   * sem precisar reler o arquivo original.
   * Passe `trx` pra participar da transacao por planilha do chamador; sem `trx`,
   * o insert em ingestion_review_queue (caso unresolved) roda fora de transacao.
   */
  async resolve(
    rawName: string,
    rawDept: string,
    sourceFile: string,
    payload?: Record<string, unknown>,
    trx?: Knex.Transaction,
  ): Promise<ResolutionResult> {
    const executor = trx ?? this.db;
    const deptConhecido = normalizeAliasText(rawDept).length > 0;
    const aliases = await this.carregarCache(executor);
    const resultado = matchAlias(aliases, rawName, rawDept, deptConhecido);

    if (resultado.matchType === 'unresolved') {
      await executor('ingestion_review_queue').insert({
        raw_name: rawName,
        raw_dept: rawDept ?? '',
        source_file: sourceFile,
        payload: payload ? JSON.stringify(payload) : null,
      });
    }

    return resultado;
  }

  /** Linhas pendentes agrupadas por (raw_name, raw_dept) normalizados - 1 grupo = 1 decisao do admin. */
  async listPendentesAgrupado(filtro: { departamento?: string; sourceFile?: string } = {}): Promise<ReviewQueueGrupo[]> {
    let query = this.db('ingestion_review_queue').where({ status: 'pending' });
    if (filtro.departamento) query = query.whereRaw('raw_dept ILIKE ?', [`%${filtro.departamento}%`]);
    if (filtro.sourceFile) query = query.where({ source_file: filtro.sourceFile });

    const linhas = await query.select('id', 'raw_name', 'raw_dept', 'source_file', 'created_at').orderBy('id', 'asc');

    const grupos = new Map<string, ReviewQueueGrupo>();
    for (const l of linhas as any[]) {
      const chave = `${normalizeAliasText(l.raw_dept)}|${normalizeAliasText(l.raw_name)}`;
      const existente = grupos.get(chave);
      if (existente) {
        existente.pendentes++;
        if (!existente.sourceFiles.includes(l.source_file)) existente.sourceFiles.push(l.source_file);
      } else {
        grupos.set(chave, {
          id: Number(l.id),
          rawName: l.raw_name,
          rawDept: l.raw_dept,
          sourceFiles: [l.source_file],
          pendentes: 1,
          criadoEm: l.created_at,
        });
      }
    }
    return [...grupos.values()];
  }

  async contarPendentes(): Promise<{ grupos: number; linhas: number }> {
    const linhas = await this.db('ingestion_review_queue').where({ status: 'pending' }).count({ total: '*' });
    const grupos = await this.listPendentesAgrupado();
    return { grupos: grupos.length, linhas: Number(linhas[0].total) };
  }

  /**
   * Candidatos pro item de revisao `id`, restritos ao mesmo departamento quando
   * conhecido; se rawDept estiver vazio (nome novo sem fonte de departamento),
   * cai pra buscar em todos os departamentos - aqui quem decide e o admin, nao
   * o algoritmo, entao cruzar departamento so pra sugestao e aceitavel.
   */
  async suggestions(reviewQueueId: number): Promise<SugestaoColaborador[]> {
    const item = await this.db('ingestion_review_queue').where({ id: reviewQueueId }).first();
    if (!item) throw new NotFoundException(`ingestion_review_queue id=${reviewQueueId} nao encontrada`);

    const nomeNorm = normalizeAliasText(item.raw_name);
    const deptNorm = normalizeAliasText(item.raw_dept);

    let candidatos = await this.db('dim_colaborador').select('id', 'nome', 'departamento');
    if (deptNorm) {
      candidatos = candidatos.filter((c: any) => normalizeAliasText(c.departamento) === deptNorm);
    }

    return candidatos
      .map((c: any) => ({
        employeeId: Number(c.id),
        canonicalName: c.nome,
        score: tokenSortRatio(nomeNorm, normalizeAliasText(c.nome)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  /**
   * Aprova o grupo (raw_name, raw_dept) do item `id`: cria/atualiza o alias,
   * invalida o cache, grava fact_performance pra todas as linhas pendentes do
   * grupo (idempotente via ON CONFLICT DO NOTHING em colaborador_id+data) e
   * marca todas como approved.
   */
  async approve(reviewQueueId: number, colaboradorId: number): Promise<ResultadoAprovacao> {
    return this.db.transaction(async (trx) => {
      const anchor = await trx('ingestion_review_queue').where({ id: reviewQueueId }).first();
      if (!anchor) throw new NotFoundException(`ingestion_review_queue id=${reviewQueueId} nao encontrada`);
      if (anchor.status !== 'pending') throw new Error(`ingestion_review_queue id=${reviewQueueId} nao esta pending (status=${anchor.status})`);

      const colaborador = await trx('dim_colaborador').where({ id: colaboradorId }).first();
      if (!colaborador) throw new NotFoundException(`dim_colaborador id=${colaboradorId} nao encontrado`);

      const nomeNorm = normalizeAliasText(anchor.raw_name);
      const deptNorm = normalizeAliasText(anchor.raw_dept);

      await trx('employee_alias')
        .insert({
          colaborador_id: colaboradorId,
          departamento_normalizado: deptNorm,
          alias_normalizado: nomeNorm,
          alias_original: anchor.raw_name,
        })
        .onConflict(['departamento_normalizado', 'alias_normalizado'])
        .merge();

      const pendentes = await trx('ingestion_review_queue').where({ status: 'pending' }).select('*');
      const doGrupo = (pendentes as any[]).filter(
        (l) => normalizeAliasText(l.raw_dept) === deptNorm && normalizeAliasText(l.raw_name) === nomeNorm,
      );

      const linhasPerformance = doGrupo
        .filter((l) => l.payload)
        .map((l) => ({ colaborador_id: colaboradorId, ...l.payload }));
      if (linhasPerformance.length > 0) {
        await trx('fact_performance').insert(linhasPerformance).onConflict(['colaborador_id', 'data']).ignore();
      }

      const ids = doGrupo.map((l) => l.id);
      await trx('ingestion_review_queue').whereIn('id', ids).update({ status: 'approved', resolved_at: trx.fn.now() });

      this.invalidateCache();
      return { employeeId: colaboradorId, canonicalName: colaborador.nome, linhasAprovadas: ids.length };
    });
  }

  /** Rejeita o grupo inteiro (raw_name, raw_dept) do item `id` - nome invalido/lixo, nao vira alias. */
  async reject(reviewQueueId: number): Promise<{ linhasRejeitadas: number }> {
    return this.db.transaction(async (trx) => {
      const anchor = await trx('ingestion_review_queue').where({ id: reviewQueueId }).first();
      if (!anchor) throw new NotFoundException(`ingestion_review_queue id=${reviewQueueId} nao encontrada`);
      if (anchor.status !== 'pending') throw new Error(`ingestion_review_queue id=${reviewQueueId} nao esta pending (status=${anchor.status})`);

      const nomeNorm = normalizeAliasText(anchor.raw_name);
      const deptNorm = normalizeAliasText(anchor.raw_dept);

      const pendentes = await trx('ingestion_review_queue').where({ status: 'pending' }).select('id', 'raw_name', 'raw_dept');
      const ids = (pendentes as any[])
        .filter((l) => normalizeAliasText(l.raw_dept) === deptNorm && normalizeAliasText(l.raw_name) === nomeNorm)
        .map((l) => l.id);

      await trx('ingestion_review_queue').whereIn('id', ids).update({ status: 'rejected', resolved_at: trx.fn.now() });
      return { linhasRejeitadas: ids.length };
    });
  }

  /** Cria dim_colaborador + primeiro alias de uma vez, pra funcionario que ainda nao existe na dimensao, e aprova o grupo com ele. */
  async newEmployee(reviewQueueId: number, canonicalName: string, departamento: string): Promise<ResultadoAprovacao> {
    const nomeKey = normalizeAliasText(canonicalName).split(' ')[0]?.toUpperCase() ?? canonicalName.toUpperCase();
    let colaborador: { id: number; nome: string };
    try {
      const [row] = await this.db('dim_colaborador')
        .insert({ nome: canonicalName, nome_key: nomeKey, departamento })
        .returning(['id', 'nome']);
      colaborador = { id: Number(row.id), nome: row.nome };
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException(
          `Ja existe um colaborador com a mesma chave de nome ("${nomeKey}") em dim_colaborador - use "aprovar" com o employeeId existente em vez de criar um novo.`,
        );
      }
      throw err;
    }
    return this.approve(reviewQueueId, colaborador.id);
  }
}
