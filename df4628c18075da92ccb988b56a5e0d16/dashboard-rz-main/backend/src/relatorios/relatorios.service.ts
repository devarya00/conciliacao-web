import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { KNEX_CONNECTION } from '../db/knex.module';
import { RelatorioGerado } from './relatorio.model';

const RELATORIOS_DIR = join(process.env.INGESTAO_DIR || './data', 'relatorios');
const SCRIPTS_DIR = join(process.cwd(), 'src', 'relatorios', 'scripts');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

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

@Injectable()
export class RelatoriosService {
  private readonly logger = new Logger(RelatoriosService.name);

  constructor(@Inject(KNEX_CONNECTION) private readonly db: Knex) {}

  async listar(): Promise<RelatorioGerado[]> {
    return this.db<RelatorioGerado>('relatorio_gerado').select('*').orderBy('created_at', 'desc');
  }

  async buscar(id: number): Promise<RelatorioGerado | undefined> {
    return this.db<RelatorioGerado>('relatorio_gerado').where({ id }).first();
  }

  async gerar(params: {
    nomeEmpresa: string;
    balancetePath: string;
    resumoPath: string;
    criadoPor: number;
  }): Promise<RelatorioGerado> {
    const [row] = await this.db<RelatorioGerado>('relatorio_gerado')
      .insert({
        nome_empresa: params.nomeEmpresa,
        status: 'processando',
        arquivo_balancete: params.balancetePath,
        arquivo_resumo: params.resumoPath,
        criado_por: params.criadoPor,
      })
      .returning('*');

    const dir = garantirDiretorio(join(RELATORIOS_DIR, String(row.id)));
    const dbPath = join(dir, 'relatorio.db');
    const xlsxPath = join(dir, 'relatorio-gerencial.xlsx');

    try {
      await executar('extract_pdfs.py', [params.balancetePath, params.resumoPath, dbPath]);
      await executar('gen_xlsx.py', [dbPath, xlsxPath]);
      const [atualizado] = await this.db<RelatorioGerado>('relatorio_gerado')
        .where({ id: row.id })
        .update({ status: 'concluido', arquivo_xlsx: xlsxPath })
        .returning('*');
      return atualizado;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      this.logger.error(`relatorio ${row.id} falhou: ${mensagem}`);
      const [atualizado] = await this.db<RelatorioGerado>('relatorio_gerado')
        .where({ id: row.id })
        .update({ status: 'erro', erro_msg: mensagem.slice(0, 2000) })
        .returning('*');
      return atualizado;
    }
  }

  async remover(id: number): Promise<void> {
    const relatorio = await this.buscar(id);
    if (!relatorio) throw new NotFoundException('Relatório não encontrado');

    await this.db('relatorio_gerado').where({ id }).delete();
    rmSync(join(RELATORIOS_DIR, String(id)), { recursive: true, force: true });
  }
}
