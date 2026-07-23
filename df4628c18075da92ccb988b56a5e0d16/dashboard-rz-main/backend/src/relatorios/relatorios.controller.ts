import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { RelatoriosService } from './relatorios.service';
import { UploadRelatorioDto } from './dto/upload-relatorio.dto';
import { AtualizarConferenciaItemDto } from './dto/atualizar-conferencia-item.dto';
import { RelatorioGerado } from './relatorio.model';
import { ConferenciaResponse } from './conferencia.model';
import { AuthUser } from '../auth/usuario.model';

const UPLOAD_DIR = join(process.env.INGESTAO_DIR || './data', 'relatorios', 'uploads');

function garantirDiretorio(): string {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

/**
 * Gerador de relatório gerencial (PDFs Domínio -> xlsx). Aberto a qualquer
 * usuário autenticado — diferente do BI (dashboard/*), restrito a admin.
 */
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  @Get()
  listar(@Req() req: Request): Promise<RelatorioGerado[]> {
    const usuario = req.user as AuthUser;
    return this.relatoriosService.listar(usuario.role === 'admin' ? undefined : usuario.id);
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'balancete', maxCount: 1 },
        { name: 'resumo', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (_req, _file, cb) => cb(null, garantirDiretorio()),
          filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
        }),
        limits: { fileSize: 20 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          const valido = /\.pdf$/i.test(file.originalname);
          cb(valido ? null : new BadRequestException('Apenas arquivos .pdf são aceitos'), valido);
        },
      },
    ),
  )
  async gerar(
    @UploadedFiles() files: { balancete?: Express.Multer.File[]; resumo?: Express.Multer.File[] },
    @Body() body: UploadRelatorioDto,
    @Req() req: Request,
  ): Promise<RelatorioGerado> {
    const balancete = files.balancete?.[0];
    const resumo = files.resumo?.[0];
    if (!balancete || !resumo) {
      throw new BadRequestException('Envie os dois PDFs: "balancete" e "resumo"');
    }

    const usuario = req.user as AuthUser;
    return this.relatoriosService.gerar({
      nomeEmpresa: body.nomeEmpresa,
      competencia: body.competencia,
      balancetePath: balancete.path,
      resumoPath: resumo.path,
      criadoPor: usuario.id,
    });
  }

  @Get(':id/conferencia')
  async obterConferencia(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<ConferenciaResponse> {
    const relatorio = await this.relatoriosService.buscar(id);
    if (!relatorio) throw new NotFoundException('Relatório não encontrado');
    this.verificarAcesso(relatorio, req.user as AuthUser);
    return this.relatoriosService.obterConferencia(id);
  }

  @Patch(':id/conferencia/:passoId')
  async atualizarConferenciaItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('passoId', ParseIntPipe) passoId: number,
    @Body() dto: AtualizarConferenciaItemDto,
    @Req() req: Request,
  ): Promise<ConferenciaResponse> {
    const relatorio = await this.relatoriosService.buscar(id);
    if (!relatorio) throw new NotFoundException('Relatório não encontrado');
    const usuario = req.user as AuthUser;
    this.verificarAcesso(relatorio, usuario);
    return this.relatoriosService.atualizarItemConferencia(id, passoId, dto, usuario.id);
  }

  @Post(':id/gerar-final')
  async gerarFinal(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<RelatorioGerado> {
    const relatorio = await this.relatoriosService.buscar(id);
    if (!relatorio) throw new NotFoundException('Relatório não encontrado');
    this.verificarAcesso(relatorio, req.user as AuthUser);
    return this.relatoriosService.gerarFinal(id);
  }

  @Get(':id/conferencia/pdf')
  async baixarConferenciaPdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const relatorio = await this.relatoriosService.buscar(id);
    if (!relatorio) throw new NotFoundException('Relatório não encontrado');
    this.verificarAcesso(relatorio, req.user as AuthUser);
    const pdf = await this.relatoriosService.gerarConferenciaPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="conferencia-${relatorio.nome_empresa}.pdf"`,
    });
    res.send(pdf);
  }

  @Get(':id/download')
  async baixar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const relatorio = await this.relatoriosService.buscar(id);
    if (!relatorio) throw new NotFoundException('Relatório não encontrado');
    this.verificarAcesso(relatorio, req.user as AuthUser);
    if (relatorio.status !== 'concluido' || !relatorio.arquivo_xlsx) {
      throw new BadRequestException('Relatório ainda não concluído');
    }

    res.download(relatorio.arquivo_xlsx, `relatorio-${relatorio.nome_empresa}.xlsx`);
  }

  @Get(':id/download/pdf')
  async baixarPdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const relatorio = await this.relatoriosService.buscar(id);
    if (!relatorio) throw new NotFoundException('Relatório não encontrado');
    this.verificarAcesso(relatorio, req.user as AuthUser);
    if (relatorio.status !== 'concluido' || !relatorio.arquivo_pdf) {
      throw new BadRequestException('Relatório ainda não concluído');
    }

    res.download(relatorio.arquivo_pdf, `relatorio-${relatorio.nome_empresa}.pdf`);
  }

  @Delete(':id')
  async remover(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<{ removido: boolean }> {
    const relatorio = await this.relatoriosService.buscar(id);
    if (!relatorio) throw new NotFoundException('Relatório não encontrado');
    this.verificarAcesso(relatorio, req.user as AuthUser);

    await this.relatoriosService.remover(id);
    return { removido: true };
  }

  /** Dono do relatório ou admin — mais ninguém baixa/apaga (BOLA/IDOR). */
  private verificarAcesso(relatorio: RelatorioGerado, usuario: AuthUser): void {
    if (usuario.role === 'admin' || relatorio.criado_por === usuario.id) return;
    throw new ForbiddenException('Você não tem acesso a esse relatório');
  }
}
