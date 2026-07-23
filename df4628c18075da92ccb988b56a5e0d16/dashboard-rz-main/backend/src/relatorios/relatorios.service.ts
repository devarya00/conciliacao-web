import { ConflictException, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Knex } from 'knex';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { chromium, Browser } from 'playwright';
import { KNEX_CONNECTION } from '../db/knex.module';
import { RelatorioGerado } from './relatorio.model';
import { AtualizarConferenciaItemDto } from './dto/atualizar-conferencia-item.dto';
import {
  ConferenciaItem,
  ConferenciaProgresso,
  ConferenciaResponse,
  ConferenciaStatus,
} from './conferencia.model';

const RELATORIOS_DIR = join(process.env.INGESTAO_DIR || './data', 'relatorios');
const SCRIPTS_DIR = join(process.cwd(), 'src', 'relatorios', 'scripts');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

/** Observação padrão pros passos sem regra automática (grupo A sem cobertura, e todo grupo B). */
const OBSERVACAO_NAO_VERIFICAVEL: Record<'A' | 'B', string> = {
  A: 'Este passo requer comparação com documento/sistema externo (folha de pagamento, ' +
    'contrato social, e-CAC) ou julgamento profissional não coberto pela extração ' +
    'automática do Balancete/Resumo por Acumulador. Revise manualmente no Domínio.',
  B: 'Este passo descreve uma ação operacional realizada no sistema Domínio antes da ' +
    'geração deste PDF — não há dado extraído para conferir automaticamente. Confirme ' +
    'que o processo foi seguido.',
};

interface SugestaoAutomatica {
  codigo: string;
  status: ConferenciaStatus;
  observacao: string;
  valorFiscal?: number | null;
  valorContabil?: number | null;
}

function garantirDiretorio(dir: string): string {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function executar(script: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [join(SCRIPTS_DIR, script), ...args]);
    let stderr = '';
    proc.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${script} saiu com código ${code}`));
    });
  });
}

/** Igual a executar(), mas também acumula e devolve o stdout (usado pelo conferencia_auto.py). */
function executarComStdout(script: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [join(SCRIPTS_DIR, script), ...args]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    proc.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `${script} saiu com código ${code}`));
    });
  });
}

@Injectable()
export class RelatoriosService implements OnModuleDestroy {
  private readonly logger = new Logger(RelatoriosService.name);
  private browser: Browser | null = null;

  constructor(@Inject(KNEX_CONNECTION) private readonly db: Knex) {}

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close();
  }

  /** Chromium headless compartilhado entre gerações — abrir um navegador por
   * PDF custaria ~1s à toa; a instância fica de pé enquanto o processo vive. */
  private async navegador(): Promise<Browser> {
    if (!this.browser) this.browser = await chromium.launch();
    return this.browser;
  }

  private async renderizarPdf(htmlPath: string, pdfPath: string): Promise<void> {
    const browser = await this.navegador();
    const page = await browser.newPage();
    try {
      await page.goto(pathToFileURL(htmlPath).href);
      await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
    } finally {
      await page.close();
    }
  }

  /** Sem criadoPor (admin), lista tudo; com criadoPor (user), só o que essa pessoa gerou. */
  async listar(criadoPor?: number): Promise<RelatorioGerado[]> {
    const query = this.db<RelatorioGerado>('relatorio_gerado').select('*').orderBy('created_at', 'desc');
    if (criadoPor !== undefined) query.where({ criado_por: criadoPor });
    return query;
  }

  async buscar(id: number): Promise<RelatorioGerado | undefined> {
    return this.db<RelatorioGerado>('relatorio_gerado').where({ id }).first();
  }

  /** Fase 1: extrai os PDFs e cria o checklist de conferência já com veredito calculado. */
  async gerar(params: {
    nomeEmpresa: string;
    competencia: string; // 'YYYY-MM'
    balancetePath: string;
    resumoPath: string;
    criadoPor: number;
  }): Promise<RelatorioGerado> {
    const [row] = await this.db<RelatorioGerado>('relatorio_gerado')
      .insert({
        nome_empresa: params.nomeEmpresa,
        competencia: `${params.competencia}-01`,
        status: 'processando',
        arquivo_balancete: params.balancetePath,
        arquivo_resumo: params.resumoPath,
        criado_por: params.criadoPor,
      })
      .returning('*');

    const dir = garantirDiretorio(join(RELATORIOS_DIR, String(row.id)));
    const dbPath = join(dir, 'relatorio.db');

    try {
      await executar('extract_pdfs.py', [params.balancetePath, params.resumoPath, dbPath]);
      await this.criarChecklistConferencia(row.id, dbPath);
      const [atualizado] = await this.db<RelatorioGerado>('relatorio_gerado')
        .where({ id: row.id })
        .update({ status: 'aguardando_conferencia' })
        .returning('*');
      return atualizado;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      this.logger.error(`relatorio ${row.id} falhou (fase 1): ${mensagem}`);
      const [atualizado] = await this.db<RelatorioGerado>('relatorio_gerado')
        .where({ id: row.id })
        .update({ status: 'erro', erro_msg: mensagem.slice(0, 2000) })
        .returning('*');
      return atualizado;
    }
  }

  /** Cria as N linhas de conferencia_item (catálogo ativo) e já aplica os vereditos. */
  private async criarChecklistConferencia(relatorioId: number, dbPath: string): Promise<void> {
    await this.db.raw(
      `INSERT INTO conferencia_item (relatorio_gerado_id, passo_id)
       SELECT ?, id FROM conferencia_passo WHERE ativo`,
      [relatorioId],
    );

    // Passos sem regra automática (grupo A sem cobertura + todo grupo B) já saem
    // 'nao_verificavel' — nunca ficam em branco esperando o contador decidir.
    for (const grupo of ['A', 'B'] as const) {
      await this.db('conferencia_item')
        .where({ relatorio_gerado_id: relatorioId })
        .whereIn('passo_id', this.db('conferencia_passo').select('id').where({ grupo }).whereNull('regra_automatica'))
        .update({
          status: 'nao_verificavel',
          observacao: OBSERVACAO_NAO_VERIFICAVEL[grupo],
          sugerido_automatico: true,
          atualizado_em: this.db.fn.now(),
        });
    }

    // Passos com regra automática: roda o script e aplica cada veredito calculado.
    // Best-effort — se o script falhar, esses itens ficam 'pendente' (o gate trata
    // pendente como "não ok", então continua bloqueado corretamente).
    try {
      const stdout = await executarComStdout('conferencia_auto.py', [dbPath]);
      const sugestoes: SugestaoAutomatica[] = JSON.parse(stdout);
      for (const s of sugestoes) {
        await this.db('conferencia_item')
          .where({ relatorio_gerado_id: relatorioId })
          .whereIn('passo_id', this.db('conferencia_passo').select('id').where({ codigo: s.codigo }))
          .update({
            status: s.status,
            observacao: s.observacao,
            valor_fiscal: s.valorFiscal ?? null,
            valor_contabil: s.valorContabil ?? null,
            sugerido_automatico: true,
            atualizado_em: this.db.fn.now(),
          });
      }
    } catch (err) {
      this.logger.warn(`pré-preenchimento automático de conferência falhou (relatorio ${relatorioId}): ${err}`);
    }
  }

  async obterConferencia(relatorioId: number): Promise<ConferenciaResponse> {
    const linhas = await this.db('conferencia_item as ci')
      .join('conferencia_passo as cp', 'cp.id', 'ci.passo_id')
      .where('ci.relatorio_gerado_id', relatorioId)
      .orderBy(['cp.grupo', 'cp.ordem'])
      .select(
        'ci.id',
        'ci.relatorio_gerado_id',
        'ci.status',
        'ci.observacao',
        'ci.valor_fiscal',
        'ci.valor_contabil',
        'ci.sugerido_automatico',
        'ci.atualizado_por',
        'ci.atualizado_em',
        'cp.id as passo_id',
        'cp.codigo',
        'cp.grupo',
        'cp.ordem',
        'cp.titulo',
        'cp.descricao',
        'cp.regra_automatica',
      );

    const itens: ConferenciaItem[] = (linhas as any[]).map((l) => ({
      id: Number(l.id),
      relatorioGeradoId: Number(l.relatorio_gerado_id),
      status: l.status,
      observacao: l.observacao,
      valorFiscal: l.valor_fiscal !== null ? Number(l.valor_fiscal) : null,
      valorContabil: l.valor_contabil !== null ? Number(l.valor_contabil) : null,
      sugeridoAutomatico: l.sugerido_automatico,
      atualizadoPor: l.atualizado_por !== null ? Number(l.atualizado_por) : null,
      atualizadoEm: l.atualizado_em,
      passo: {
        id: Number(l.passo_id),
        codigo: l.codigo,
        grupo: l.grupo,
        ordem: Number(l.ordem),
        titulo: l.titulo,
        descricao: l.descricao,
        regraAutomatica: l.regra_automatica,
      },
    }));

    const progresso = this.calcularProgresso(itens);
    return { itens, progresso, podeGerarFinal: this.podeGerarFinal(progresso) };
  }

  private calcularProgresso(itens: ConferenciaItem[]): ConferenciaProgresso {
    const automatizaveis = itens.filter((i) => i.passo.regraAutomatica !== null);
    return {
      totalAutomatizavel: automatizaveis.length,
      okAutomatizavel: automatizaveis.filter((i) => i.status === 'ok').length,
      divergenciaAutomatizavel: automatizaveis.filter((i) => i.status === 'divergencia').length,
      totalGeral: itens.length,
    };
  }

  private podeGerarFinal(progresso: ConferenciaProgresso): boolean {
    return progresso.totalAutomatizavel > 0 && progresso.okAutomatizavel === progresso.totalAutomatizavel;
  }

  /** Override manual do contador sobre um item (automático ou não). */
  async atualizarItemConferencia(
    relatorioId: number,
    passoId: number,
    dto: AtualizarConferenciaItemDto,
    usuarioId: number,
  ): Promise<ConferenciaResponse> {
    const item = await this.db('conferencia_item')
      .where({ relatorio_gerado_id: relatorioId, passo_id: passoId })
      .first();
    if (!item) throw new NotFoundException('Item de conferência não encontrado para este relatório');

    await this.db('conferencia_item')
      .where({ id: item.id })
      .update({
        status: dto.status,
        observacao: dto.observacao ?? null,
        sugerido_automatico: false,
        atualizado_por: usuarioId,
        atualizado_em: this.db.fn.now(),
      });

    return this.obterConferencia(relatorioId);
  }

  /** Fase 2: só roda o pipeline pesado (xlsx/html/pdf) depois do gate validado. */
  async gerarFinal(id: number): Promise<RelatorioGerado> {
    const relatorio = await this.buscar(id);
    if (!relatorio) throw new NotFoundException('Relatório não encontrado');
    if (relatorio.status !== 'aguardando_conferencia') {
      throw new ConflictException('Relatório não está aguardando conferência');
    }

    const { progresso, podeGerarFinal } = await this.obterConferencia(id);
    if (!podeGerarFinal) {
      const faltam = progresso.totalAutomatizavel - progresso.okAutomatizavel;
      throw new ConflictException(
        `Conferência incompleta: ${faltam} de ${progresso.totalAutomatizavel} item(ns) automatizável(is) ainda não estão OK.`,
      );
    }

    await this.db('relatorio_gerado').where({ id }).update({ status: 'processando_final', erro_msg: null });

    const dir = join(RELATORIOS_DIR, String(id));
    const dbPath = join(dir, 'relatorio.db');
    const xlsxPath = join(dir, 'relatorio-gerencial.xlsx');
    const htmlPath = join(dir, 'relatorio-gerencial.html');
    const pdfPath = join(dir, 'relatorio-gerencial.pdf');

    try {
      await executar('gen_xlsx.py', [dbPath, xlsxPath]);
      await executar('gen_html.py', [dbPath, htmlPath]);
      await this.renderizarPdf(htmlPath, pdfPath);
      const [atualizado] = await this.db<RelatorioGerado>('relatorio_gerado')
        .where({ id })
        .update({ status: 'concluido', arquivo_xlsx: xlsxPath, arquivo_pdf: pdfPath })
        .returning('*');
      return atualizado;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      this.logger.error(`relatorio ${id} falhou (fase 2): ${mensagem}`);
      // Volta pra aguardando_conferencia (não erro terminal) — permite tentar de
      // novo sem re-upload; erro_msg fica só como aviso transitório da tentativa.
      const [atualizado] = await this.db<RelatorioGerado>('relatorio_gerado')
        .where({ id })
        .update({ status: 'aguardando_conferencia', erro_msg: mensagem.slice(0, 2000) })
        .returning('*');
      return atualizado;
    }
  }

  /** PDF de conferência: sempre gerável, mesmo com itens pendentes/divergência. Não persiste arquivo. */
  async gerarConferenciaPdf(id: number): Promise<Buffer> {
    const relatorio = await this.buscar(id);
    if (!relatorio) throw new NotFoundException('Relatório não encontrado');

    const { itens, progresso } = await this.obterConferencia(id);
    const html = this.montarHtmlConferencia(relatorio, itens, progresso);

    const browser = await this.navegador();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    } finally {
      await page.close();
    }
  }

  /** knex/pg devolve `date` como Date (ou null) - formata "MM/YYYY" pro PDF de conferência. */
  private formatarCompetencia(competencia: unknown): string {
    if (!competencia) return '—';
    const d = competencia instanceof Date ? competencia : new Date(String(competencia));
    if (isNaN(d.getTime())) return String(competencia);
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }

  private montarHtmlConferencia(
    relatorio: RelatorioGerado,
    itens: ConferenciaItem[],
    progresso: ConferenciaProgresso,
  ): string {
    // knex/pg devolve colunas `date` como Date, nao string, apesar do tipo RelatorioGerado
    // dizer string - String(s) cobre os dois casos sem quebrar em runtime.
    const esc = (s: unknown) =>
      String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const corStatus: Record<ConferenciaStatus, string> = {
      ok: '#0ca30c',
      divergencia: '#c0392b',
      nao_verificavel: '#6b7280',
      pendente: '#b5790a',
    };
    const rotuloStatus: Record<ConferenciaStatus, string> = {
      ok: 'OK',
      divergencia: 'DIVERGÊNCIA',
      nao_verificavel: 'NÃO VERIFICÁVEL',
      pendente: 'PENDENTE',
    };
    const linha = (i: ConferenciaItem) => `
      <tr>
        <td style="white-space:nowrap;color:#666">${esc(i.passo.codigo)}</td>
        <td>${esc(i.passo.titulo)}</td>
        <td><span style="color:${corStatus[i.status]};font-weight:bold">${rotuloStatus[i.status]}</span></td>
        <td>${esc(i.observacao)}</td>
      </tr>`;
    const grupoA = itens.filter((i) => i.passo.grupo === 'A' && i.valorContabil === null).map(linha).join('');
    const grupoB = itens.filter((i) => i.passo.grupo === 'B' && i.valorContabil === null).map(linha).join('');
    const pct = progresso.totalAutomatizavel > 0
      ? Math.round((progresso.okAutomatizavel / progresso.totalAutomatizavel) * 100)
      : 0;

    // Comparação numérica (Fornecedores/Estoque/Receita x resumo) - tabela
    // compacta, menos texto: valores em colunas, status OK/CRÍTICO só aqui.
    const fmtMoeda = (v: number) =>
      v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const comparacoes = itens.filter((i) => i.valorContabil !== null);
    const linhaComparacao = (i: ConferenciaItem) => {
      const temFiscal = i.valorFiscal !== null;
      const diferenca = temFiscal ? (i.valorFiscal as number) - (i.valorContabil as number) : null;
      const critico = i.status === 'divergencia';
      return `
      <tr>
        <td style="white-space:nowrap;color:#666">${esc(i.passo.codigo)}</td>
        <td><span style="color:${critico ? '#c0392b' : '#0ca30c'};font-weight:bold">${critico ? 'CRÍTICO' : 'OK'}</span></td>
        <td>${esc(i.passo.titulo)}</td>
        <td style="text-align:right">${temFiscal ? fmtMoeda(i.valorFiscal as number) : '—'}</td>
        <td style="text-align:right">${fmtMoeda(i.valorContabil as number)}</td>
        <td style="text-align:right;color:${diferenca !== null && Math.abs(diferenca) > 0.01 ? '#c0392b' : '#1a1a1a'}">${diferenca !== null ? fmtMoeda(diferenca) : '—'}</td>
      </tr>`;
    };
    const tabelaComparacao = comparacoes.length
      ? `<h2>Comparação Fiscal x Contábil</h2>
         <table>
           <thead><tr><th>Regra</th><th>Status</th><th>Descrição</th><th style="text-align:right">Vlr Fiscal</th><th style="text-align:right">Vlr Contábil</th><th style="text-align:right">Diferença</th></tr></thead>
           <tbody>${comparacoes.map(linhaComparacao).join('')}</tbody>
         </table>`
      : '';

    return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
  h1 { font-size: 16px; margin-bottom: 2px; }
  h2 { font-size: 13px; margin-top: 24px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .sub { color: #555; margin-bottom: 12px; }
  .barra { background: #eee; border-radius: 6px; height: 14px; width: 100%; overflow: hidden; margin: 8px 0 4px; }
  .barra-fill { background: #0ca30c; height: 100%; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  td, th { border-bottom: 1px solid #eee; padding: 4px 6px; vertical-align: top; }
  th { text-align: left; color: #666; }
</style></head>
<body>
  <h1>Relatório de Conferência — ${esc(relatorio.nome_empresa)}</h1>
  <div class="sub">Competência: ${esc(this.formatarCompetencia(relatorio.competencia))} · Emitido em ${new Date().toLocaleString('pt-BR')}</div>
  <div>Itens automatizáveis OK: ${progresso.okAutomatizavel}/${progresso.totalAutomatizavel} (${pct}%)</div>
  <div class="barra"><div class="barra-fill" style="width:${pct}%"></div></div>
  ${tabelaComparacao}
  <h2>Conferência e Validação da Integração Contábil</h2>
  <table>${grupoA}</table>
  <h2>Apuração/Encerramento Contábil</h2>
  <table>${grupoB}</table>
</body></html>`;
  }

  async remover(id: number): Promise<void> {
    const relatorio = await this.buscar(id);
    if (!relatorio) throw new NotFoundException('Relatório não encontrado');

    await this.db('relatorio_gerado').where({ id }).delete();
    rmSync(join(RELATORIOS_DIR, String(id)), { recursive: true, force: true });
  }
}
