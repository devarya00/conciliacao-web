import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../db/knex.module';
import { FiltroDto } from './dto/filtro.dto';
import { KpiDto } from './dto/kpi.dto';
import { SerieTempoDto } from './dto/serie-tempo.dto';
import { StatusTempoDto } from './dto/status-tempo.dto';
import { WorkmonitorColaboradorDto, WorkmonitorTotaisDto } from './dto/workmonitor.dto';
import { RankingDto } from './dto/ranking.dto';
import { TaskTypeDto } from './dto/task-type.dto';
import { ReinfDto } from './dto/reinf.dto';
import { FiltrosOptionsDto } from './dto/filtros-options.dto';
import { chaveObrigacao } from '../common/text.util';

/**
 * Data mestre do filtro: prazo_tecnico (planilha S3D) - mesmo campo em toda
 * linha, entregue ou nao, por isso usado sozinho (sem COALESCE com
 * data_entrega) em toda query filtrada por periodo.
 */
const DATA_MESTRE = 'prazo_tecnico';

@Injectable()
export class DashboardService {
  constructor(@Inject(KNEX_CONNECTION) private readonly db: Knex) {}

  /**
   * Query base de fact_entrega com periodo + departamento + reinf aplicados.
   * Com f.dedup, le da view v_entrega_dedup ALIASADA como fact_entrega - todas
   * as referencias qualificadas (fact_entrega.colaborador_id etc.) continuam
   * validas sem duplicar query em nenhum consumidor.
   */
  private qbEntregas(f: FiltroDto): Knex.QueryBuilder {
    const qb = this.db(f.dedup ? { fact_entrega: 'v_entrega_dedup' } : 'fact_entrega')
      .whereRaw(`${DATA_MESTRE} BETWEEN ? AND ?`, [f.dataInicial, f.dataFinal]);

    if (f.departamento && f.departamento !== 'Todos') {
      qb.andWhere({ departamento: f.departamento });
    }
    if (f.somenteReinf) {
      qb.andWhere({ is_reinf: true });
    }
    return qb;
  }

  async kpis(f: FiltroDto): Promise<KpiDto> {
    const base = this.qbEntregas(f);

    const [{ count: tarefas }] = await base
      .clone()
      .where({ status_class: 'entregue' })
      .count({ count: '*' });

    const [{ count: empresas }] = await base
      .clone()
      .where({ status_class: 'entregue' })
      .countDistinct({ count: 'emp_id' });

    const [{ count: reinfFechados }] = await base
      .clone()
      .where({ is_reinf: true, status_class: 'entregue' })
      .count({ count: '*' });

    const [{ count: reinfPendentes }] = await base
      .clone()
      .where({ is_reinf: true, status_class: 'pendente' })
      .count({ count: '*' });

    // Contagem por status_class (cards de filtro pendente/justificada/entregue/dispensada
    // + total geral) - agrupa numa unica query em vez de 5 counts separados.
    const porStatus = await base.clone().select('status_class').count({ qtd: '*' }).groupBy('status_class');

    const qtdPorClasse = new Map<string, number>(
      (porStatus as any[]).map((r) => [r.status_class, Number(r.qtd)]),
    );
    const totalTarefas = [...qtdPorClasse.values()].reduce((acc, n) => acc + n, 0);

    return {
      empresas: Number(empresas),
      tarefas: Number(tarefas),
      reinfFechados: Number(reinfFechados),
      reinfPendentes: Number(reinfPendentes),
      pendentes: qtdPorClasse.get('pendente') ?? 0,
      justificadas: qtdPorClasse.get('justificada') ?? 0,
      entregues: qtdPorClasse.get('entregue') ?? 0,
      dispensadas: qtdPorClasse.get('dispensada') ?? 0,
      totalTarefas,
    };
  }

  async serieTempo(f: FiltroDto): Promise<SerieTempoDto[]> {
    const base = this.qbEntregas(f);

    const linhas = await base
      .clone()
      .select(this.db.raw(`${DATA_MESTRE} as data`))
      .count({ entregues: this.db.raw(`CASE WHEN status_class = 'entregue' THEN 1 END`) })
      .count({ reinf: this.db.raw(`CASE WHEN is_reinf AND status_class = 'entregue' THEN 1 END`) })
      .groupByRaw(DATA_MESTRE)
      .orderByRaw(DATA_MESTRE);

    // score medio por dia, cruzando fact_performance via dim_colaborador (nome_key nao entra aqui:
    // fact_performance nao tem vinculo direto com fact_entrega, entao o eixo de score usa a media
    // diaria de score_genia no mesmo periodo/departamento, independente da obrigacao).
    const scoreQb = this.db('fact_performance as fp')
      .join('v_colaborador as dc', 'dc.colaborador_id', 'fp.colaborador_id')
      .where({ 'dc.is_pessoa': true, 'dc.active_employee': true })
      .whereBetween('fp.data', [f.dataInicial, f.dataFinal])
      .select('fp.data')
      .avg({ scoreMedio: 'fp.score_genia' })
      .groupBy('fp.data');

    if (f.departamento && f.departamento !== 'Todos') {
      scoreQb.andWhere('dc.departamento', f.departamento);
    }

    const scores = await scoreQb;
    const scoreByDate = new Map<string, number>(
      scores.map((s: any) => [this.toIsoDate(s.data), Number(s.scoreMedio)]),
    );

    return linhas.map((l: any) => {
      const data = this.toIsoDate(l.data);
      return {
        data,
        entregues: Number(l.entregues),
        reinf: Number(l.reinf),
        scoreMedio: scoreByDate.has(data) ? scoreByDate.get(data)! : null,
      };
    });
  }

  /** Status ao longo do tempo (Workmonitor): soma produtivo/ocio/improdutivo/neutro por dia. */
  async statusTempo(f: FiltroDto): Promise<StatusTempoDto[]> {
    const qb = this.db('fact_performance as fp')
      .join('v_colaborador as dc', 'dc.colaborador_id', 'fp.colaborador_id')
      .where({ 'dc.is_pessoa': true, 'dc.active_employee': true })
      .whereBetween('fp.data', [f.dataInicial, f.dataFinal])
      .select('fp.data')
      .sum({
        produtivoS: 'fp.produtivo_s',
        ocioS: 'fp.ocio_s',
        improdutivoS: 'fp.improdutivo_s',
        neutroS: 'fp.neutro_s',
      })
      .groupBy('fp.data')
      .orderBy('fp.data');

    if (f.departamento && f.departamento !== 'Todos') {
      qb.andWhere('dc.departamento', f.departamento);
    }
    if (f.colaborador && f.colaborador !== 'Todos') {
      qb.andWhere('dc.nome', f.colaborador);
    }

    const linhas = await qb;
    return linhas.map((l: any) => ({
      data: this.toIsoDate(l.data),
      produtivoS: Number(l.produtivoS) || 0,
      ocioS: Number(l.ocioS) || 0,
      improdutivoS: Number(l.improdutivoS) || 0,
      neutroS: Number(l.neutroS) || 0,
    }));
  }

  /** Aplica departamento/colaborador (quando != 'Todos') num qb de fact_performance ja joinado com dim_colaborador as dc. */
  private aplicarFiltroColaborador(qb: Knex.QueryBuilder, f: FiltroDto): void {
    if (f.departamento && f.departamento !== 'Todos') qb.andWhere('dc.departamento', f.departamento);
    if (f.colaborador && f.colaborador !== 'Todos') qb.andWhere('dc.nome', f.colaborador);
  }

  /** Totais do periodo (Workmonitor): base dos 4 cartoes de KPI e dos aneis de % da aba Workmonitor. */
  async workmonitorTotais(f: FiltroDto): Promise<WorkmonitorTotaisDto> {
    const qb = this.db('fact_performance as fp')
      .join('v_colaborador as dc', 'dc.colaborador_id', 'fp.colaborador_id')
      .where({ 'dc.is_pessoa': true, 'dc.active_employee': true })
      .whereBetween('fp.data', [f.dataInicial, f.dataFinal])
      .sum({
        produtivoS: 'fp.produtivo_s',
        improdutivoS: 'fp.improdutivo_s',
        ocioS: 'fp.ocio_s',
        neutroS: 'fp.neutro_s',
      });
    this.aplicarFiltroColaborador(qb, f);

    const [r] = await qb;
    return {
      produtivoS: Number(r.produtivoS) || 0,
      improdutivoS: Number(r.improdutivoS) || 0,
      ocioS: Number(r.ocioS) || 0,
      neutroS: Number(r.neutroS) || 0,
    };
  }

  /** Por colaborador (Workmonitor): base da tabela e do grafico de dispersao tempo produtivo x score. */
  async workmonitorColaboradores(f: FiltroDto): Promise<WorkmonitorColaboradorDto[]> {
    const qb = this.db('fact_performance as fp')
      .join('v_colaborador as dc', 'dc.colaborador_id', 'fp.colaborador_id')
      .where({ 'dc.is_pessoa': true, 'dc.active_employee': true })
      .whereBetween('fp.data', [f.dataInicial, f.dataFinal])
      .select('dc.canonical_id as colaboradorId', 'dc.nome as nome')
      .sum({
        jornadaS: 'fp.jornada_s',
        produtivoS: 'fp.produtivo_s',
        improdutivoS: 'fp.improdutivo_s',
        ocioS: 'fp.ocio_s',
        neutroS: 'fp.neutro_s',
      })
      .avg({ score: 'fp.score_genia' })
      .groupBy('dc.canonical_id', 'dc.nome')
      .orderBy('dc.nome');
    this.aplicarFiltroColaborador(qb, f);

    const linhas = await qb;
    return linhas.map((l: any) => {
      const produtivoS = Number(l.produtivoS) || 0;
      const captadasS = produtivoS + (Number(l.improdutivoS) || 0) + (Number(l.ocioS) || 0) + (Number(l.neutroS) || 0);
      return {
        colaboradorId: Number(l.colaboradorId),
        nome: l.nome,
        jornadaS: Number(l.jornadaS) || 0,
        captadasS,
        produtivoS,
        percentualProdutivo: captadasS > 0 ? Math.round((produtivoS / captadasS) * 1000) / 10 : 0,
        score: l.score !== null ? Number(l.score) : null,
      };
    });
  }

  async ranking(f: FiltroDto): Promise<RankingDto[]> {
    // fact_produtividade (Onvio) e fact_performance (Workmonitor) vem de exports
    // de dias diferentes cada uma - juntar por fpf.data = fpd.data nunca bate na
    // pratica. Agrega cada uma separadamente no periodo e cruza por colaborador
    // em JS (mesmo padrao do scoreByDate em serieTempo()).
    const produtividadeQb = this.db('fact_produtividade as fpd')
      .join('v_colaborador as dc', 'dc.colaborador_id', 'fpd.colaborador_id')
      .where({ 'dc.is_pessoa': true, 'dc.active_employee': true })
      .whereBetween('fpd.data', [f.dataInicial, f.dataFinal])
      .groupBy('dc.canonical_id', 'dc.nome', 'dc.departamento')
      .select('dc.canonical_id as colaboradorId', 'dc.nome as nome', 'dc.departamento as departamento')
      .sum({ concluidos: 'fpd.concluidos' })
      .sum({ abertos: 'fpd.abertos' })
      .avg({ tempoMedioS: 'fpd.tempo_medio_s' })
      .avg({ satisfacao: 'fpd.satisfacao' })
      .orderBy('concluidos', 'desc');

    const scoreQb = this.db('fact_performance as fpf')
      .join('v_colaborador as dc', 'dc.colaborador_id', 'fpf.colaborador_id')
      .where({ 'dc.is_pessoa': true, 'dc.active_employee': true })
      .whereBetween('fpf.data', [f.dataInicial, f.dataFinal])
      .groupBy('dc.canonical_id')
      .select('dc.canonical_id as colaboradorId')
      .avg({ scoreGenia: 'fpf.score_genia' });

    // Pontos de tarefas: fact_entrega.colaborador_id so existe quando Responsavel
    // prazo/entrega bateram no S3D (ver s3d.parser). Cruza obrigacao -> pontos
    // (dim_tarefa_pontos) em JS via chaveObrigacao, mesmo padrao dos outros cruzamentos.
    // Conta pelo MES DO PRAZO TECNICO (DATA_MESTRE, mesma base do filtro de periodo),
    // nao pela competencia da obrigacao - backlog atrasado entregue em lote conta no mes
    // do prazo original, nao no mes de referencia da competencia.
    const tarefasQb = this.qbEntregas(f)
      .clone()
      .join('v_colaborador as dcte', 'dcte.colaborador_id', 'fact_entrega.colaborador_id')
      .andWhere({ status_class: 'entregue' })
      .where({ 'dcte.is_pessoa': true, 'dcte.active_employee': true })
      .whereNotNull('fact_entrega.colaborador_id')
      .select(
        'dcte.canonical_id as colaboradorId',
        'fact_entrega.obrigacao as obrigacao',
        this.db.raw(`date_trunc('month', ${DATA_MESTRE}) as mes`),
      )
      .count({ qtd: '*' })
      .groupBy('dcte.canonical_id', 'fact_entrega.obrigacao', this.db.raw(`date_trunc('month', ${DATA_MESTRE})`));

    // Entregas em aberto no periodo, mesma fonte S3D dos pontos - usado pela
    // tabela de pontuacao (planilha antiga contava Concluidos/Abertos do S3D,
    // nao do Onvio). status_class = f.statusClasses quando informado (filtro
    // de status dos cards de KPI), senao 'pendente' (comportamento default).
    // Nao mexe em tarefasQb/pontos acima - premio continua sempre por entregue.
    const abertasQb = this.qbEntregas(f)
      .clone()
      .join('v_colaborador as dcab', 'dcab.colaborador_id', 'fact_entrega.colaborador_id')
      .whereIn('status_class', f.statusClasses?.length ? f.statusClasses : ['pendente'])
      .where({ 'dcab.is_pessoa': true, 'dcab.active_employee': true })
      .whereNotNull('fact_entrega.colaborador_id')
      .select('dcab.canonical_id as colaboradorId')
      .count({ qtd: '*' })
      .groupBy('dcab.canonical_id');

    // Pontos de atendimento: contagem de avaliacoes "muito satisfeito" (nota 5) no
    // periodo x 5 pontos - controle a parte, sem relacao com fact_entrega/tarefas.
    // Agrupa por mes (date_trunc) tambem p/ aplicar o valor do ponto vigente.
    const atendimentoQb = this.db('fact_atendimento as fa')
      .join('v_colaborador as dc2', 'dc2.colaborador_id', 'fa.colaborador_id')
      .where({ 'dc2.is_pessoa': true, 'dc2.active_employee': true })
      .whereBetween('fa.data', [f.dataInicial, f.dataFinal])
      .andWhere('fa.nota', 5)
      .groupBy('dc2.canonical_id', this.db.raw(`date_trunc('month', fa.data)`))
      .select('dc2.canonical_id as colaboradorId', this.db.raw(`date_trunc('month', fa.data) as mes`))
      .count({ qtd: '*' });

    if (f.departamento && f.departamento !== 'Todos') {
      produtividadeQb.andWhere('dc.departamento', f.departamento);
      scoreQb.andWhere('dc.departamento', f.departamento);
      atendimentoQb.andWhere('dc2.departamento', f.departamento);
    }
    if (f.colaborador && f.colaborador !== 'Todos') {
      produtividadeQb.andWhere('dc.nome', f.colaborador);
      scoreQb.andWhere('dc.nome', f.colaborador);
      atendimentoQb.andWhere('dc2.nome', f.colaborador);
      tarefasQb.andWhere('dcte.nome', f.colaborador);
      abertasQb.andWhere('dcab.nome', f.colaborador);
    }

    const [rows, scores, tarefasRows, abertasRows, atendimentoRows, legenda, valorPontoHistorico] = await Promise.all([
      produtividadeQb,
      scoreQb,
      tarefasQb,
      abertasQb,
      atendimentoQb,
      this.db('dim_tarefa_pontos').select('obrigacao_key', 'pontos'),
      this.db('config_valor_ponto').select('competencia', 'valor').orderBy('competencia', 'asc'),
    ]);

    const scoreByColaborador = new Map<number, number>(
      (scores as any[]).map((s) => [Number(s.colaboradorId), Number(s.scoreGenia)]),
    );

    // valor do ponto vigente num mes = ultima linha com competencia <= mes (tabela
    // pequena, ordenada asc - scan linear e suficiente).
    const historicoOrdenado = (valorPontoHistorico as any[]).map((v) => ({
      competencia: this.toIsoDate(v.competencia),
      valor: Number(v.valor),
    }));
    const valorPontoEm = (competenciaIso: string): number => {
      let valor = 0;
      for (const v of historicoOrdenado) {
        if (v.competencia <= competenciaIso) valor = v.valor;
        else break;
      }
      return valor;
    };

    const pontosPorChave = new Map<string, number>(
      (legenda as any[]).map((l) => [l.obrigacao_key, Number(l.pontos)]),
    );
    const pontosTarefasPorColaborador = new Map<number, number>();
    const premioPorColaborador = new Map<number, number>();
    const entregasConcluidasPorColaborador = new Map<number, number>();
    for (const r of tarefasRows as any[]) {
      const cid = Number(r.colaboradorId);
      const qtd = Number(r.qtd);
      const pontos = (pontosPorChave.get(chaveObrigacao(r.obrigacao)) ?? 0) * qtd;
      const premio = pontos * valorPontoEm(this.toIsoDate(r.mes));
      pontosTarefasPorColaborador.set(cid, (pontosTarefasPorColaborador.get(cid) ?? 0) + pontos);
      premioPorColaborador.set(cid, (premioPorColaborador.get(cid) ?? 0) + premio);
      entregasConcluidasPorColaborador.set(cid, (entregasConcluidasPorColaborador.get(cid) ?? 0) + qtd);
    }

    const entregasAbertasPorColaborador = new Map<number, number>(
      (abertasRows as any[]).map((a) => [Number(a.colaboradorId), Number(a.qtd)]),
    );

    const pontosAtendimentoPorColaborador = new Map<number, number>();
    const atendimentosMuitoSatisfeitoPorColaborador = new Map<number, number>();
    for (const a of atendimentoRows as any[]) {
      const cid = Number(a.colaboradorId);
      const qtd = Number(a.qtd);
      const pontos = qtd * 5;
      const premio = pontos * valorPontoEm(this.toIsoDate(a.mes));
      pontosAtendimentoPorColaborador.set(cid, (pontosAtendimentoPorColaborador.get(cid) ?? 0) + pontos);
      premioPorColaborador.set(cid, (premioPorColaborador.get(cid) ?? 0) + premio);
      atendimentosMuitoSatisfeitoPorColaborador.set(cid, (atendimentosMuitoSatisfeitoPorColaborador.get(cid) ?? 0) + qtd);
    }

    // fact_entrega/fact_atendimento podem ter colaborador sem par em fact_produtividade
    // (Onvio) no periodo - sem isso, pontos/premio desses colaboradores desapareceriam
    // do ranking em vez de aparecer com concluidos/score em branco.
    const colaboradorPorId = new Map<number, { nome: string; departamento: string | null }>(
      (rows as any[]).map((r) => [Number(r.colaboradorId), { nome: r.nome, departamento: r.departamento ?? null }]),
    );
    const idsFaltantes = [...new Set([
      ...pontosTarefasPorColaborador.keys(),
      ...pontosAtendimentoPorColaborador.keys(),
      ...entregasAbertasPorColaborador.keys(),
    ])].filter((id) => !colaboradorPorId.has(id));
    if (idsFaltantes.length > 0) {
      const extras = await this.db('dim_colaborador').whereIn('id', idsFaltantes).select('id', 'nome', 'departamento');
      for (const e of extras as any[]) {
        colaboradorPorId.set(Number(e.id), { nome: e.nome, departamento: e.departamento ?? null });
      }
    }

    const todosColaboradorIds = new Set<number>([
      ...(rows as any[]).map((r) => Number(r.colaboradorId)),
      ...idsFaltantes,
    ]);
    const produtividadePorColaborador = new Map<number, any>((rows as any[]).map((r) => [Number(r.colaboradorId), r]));

    return [...todosColaboradorIds].map((colaboradorId) => {
      const r = produtividadePorColaborador.get(colaboradorId);
      const info = colaboradorPorId.get(colaboradorId)!;
      const pontosTarefas = pontosTarefasPorColaborador.get(colaboradorId) ?? 0;
      const pontosAtendimento = pontosAtendimentoPorColaborador.get(colaboradorId) ?? 0;
      return {
        colaboradorId,
        nome: info.nome,
        departamento: info.departamento,
        concluidos: r ? Number(r.concluidos ?? 0) : 0,
        abertos: r ? Number(r.abertos ?? 0) : 0,
        tempoMedioS: r && r.tempoMedioS !== null ? Number(r.tempoMedioS) : null,
        satisfacao: r && r.satisfacao !== null ? Number(r.satisfacao) : null,
        scoreGenia: scoreByColaborador.get(colaboradorId) ?? null,
        pontosTarefas,
        pontosAtendimento,
        pontosTotal: pontosTarefas + pontosAtendimento,
        atendimentosMuitoSatisfeito: atendimentosMuitoSatisfeitoPorColaborador.get(colaboradorId) ?? 0,
        entregasConcluidas: entregasConcluidasPorColaborador.get(colaboradorId) ?? 0,
        entregasAbertas: entregasAbertasPorColaborador.get(colaboradorId) ?? 0,
        premio: Number((premioPorColaborador.get(colaboradorId) ?? 0).toFixed(2)),
      };
    });
  }

  async tiposTarefa(f: FiltroDto): Promise<TaskTypeDto[]> {
    // status_class = f.statusClasses quando informado (filtro de status dos
    // cards de KPI), senao 'entregue' (comportamento default/antigo).
    const base = this.qbEntregas(f)
      .clone()
      .whereIn('status_class', f.statusClasses?.length ? f.statusClasses : ['entregue']);

    const rows = await base
      .clone()
      .select('obrigacao')
      .count({ volume: '*' })
      .groupBy('obrigacao')
      .orderBy('volume', 'desc');

    const total = rows.reduce((acc: number, r: any) => acc + Number(r.volume), 0);

    return rows.map((r: any) => ({
      obrigacao: r.obrigacao,
      volume: Number(r.volume),
      percentual: total > 0 ? Number(((Number(r.volume) / total) * 100).toFixed(2)) : 0,
    }));
  }

  async reinf(f: FiltroDto): Promise<ReinfDto> {
    const base = this.qbEntregas(f).clone().andWhere({ is_reinf: true });

    const [{ count: fechados }] = await base
      .clone()
      .where({ status_class: 'entregue' })
      .count({ count: '*' });

    const [{ count: aFechar }] = await base
      .clone()
      .where({ status_class: 'pendente' })
      .count({ count: '*' });

    const f2 = Number(fechados);
    const a2 = Number(aFechar);
    const total = f2 + a2;

    return {
      fechados: f2,
      aFechar: a2,
      percentualConclusao: total > 0 ? Number(((f2 / total) * 100).toFixed(2)) : 0,
    };
  }

  async filtros(): Promise<FiltrosOptionsDto> {
    const departamentosRows = await this.db('fact_entrega')
      .distinct('departamento')
      .whereNotNull('departamento')
      .orderBy('departamento');

    // So pessoas reais e ativas, ja resolvidas na identidade canonica (v_colaborador).
    const colaboradoresRows = await this.db('v_colaborador')
      .where({ is_pessoa: true, active_employee: true })
      .distinct('canonical_id as id', 'nome')
      .orderBy('nome');

    // Cruza as 3 fontes: fact_produtividade/fact_performance (Onvio/Workmonitor)
    // podem cair fora do range de fact_entrega (S3D) - usar so uma tabela aqui
    // reproduziria o mesmo bug do filtro de data que ja corrigimos no frontend.
    const [entregaRange, produtividadeRange, performanceRange] = await Promise.all([
      this.db('fact_entrega').select(
        this.db.raw(`MIN(${DATA_MESTRE}) as min`),
        this.db.raw(`MAX(${DATA_MESTRE}) as max`),
      ),
      this.db('fact_produtividade').min({ min: 'data' }).max({ max: 'data' }),
      this.db('fact_performance').min({ min: 'data' }).max({ max: 'data' }),
    ]);

    const datas = [entregaRange[0], produtividadeRange[0], performanceRange[0]]
      .flatMap((r: any) => [r.min, r.max])
      .filter((d): d is string | Date => d !== null)
      .map((d) => this.toIsoDate(d));

    return {
      departamentos: departamentosRows.map((r: any) => r.departamento),
      colaboradores: colaboradoresRows.map((r: any) => ({ id: Number(r.id), nome: r.nome })),
      minData: datas.length ? datas.reduce((a, b) => (a < b ? a : b)) : null,
      maxData: datas.length ? datas.reduce((a, b) => (a > b ? a : b)) : null,
    };
  }

  private toIsoDate(value: string | Date): string {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }
}
