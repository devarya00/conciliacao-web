import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { IngestaoService, ArquivoIngestao } from './ingestao/ingestao.service';
import { UploadArquivoDto } from './dto/upload-arquivo.dto';
import { Roles } from '../auth/roles.decorator';

const UPLOAD_DIR = join(process.env.INGESTAO_DIR || './data', 'uploads');

function garantirDiretorio(): string {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

/** Planilhas enviadas: upload, listagem e exclusão (a exclusão remove também os dados derivados). */
@Roles('admin')
@Controller('dashboard/arquivos')
export class ArquivosController {
  constructor(private readonly ingestaoService: IngestaoService) {}

  @Get()
  listar(
    @Query('dataInicial') dataInicial?: string,
    @Query('dataFinal') dataFinal?: string,
  ): Promise<ArquivoIngestao[]> {
    return this.ingestaoService.listar({ dataInicial, dataFinal });
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, garantirDiretorio()),
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const valido = /\.(xlsx|xls|csv)$/i.test(file.originalname);
        cb(valido ? null : new BadRequestException('Apenas arquivos .xlsx/.xls/.csv são aceitos'), valido);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadArquivoDto,
  ): Promise<ArquivoIngestao> {
    if (!file) throw new BadRequestException('Arquivo não enviado (campo "arquivo")');

    const resultado = await this.ingestaoService.ingerirArquivo({
      nomeOriginal: file.originalname,
      caminhoArquivo: file.path,
      origem: body.origem,
      tamanhoBytes: file.size,
    });

    // Sem isso, colaborador novo/fragmentado por este upload fica sem
    // canonical_id ate alguem rodar roster:apply na mao - mesma lacuna do
    // executar() (cron), so que no caminho manual da UI.
    await this.ingestaoService.aplicarRosterCanonico();

    return resultado;
  }

  @Delete(':id')
  async remover(@Param('id', ParseIntPipe) id: number): Promise<{ removido: boolean }> {
    const arquivo = await this.ingestaoService.buscar(id);
    if (!arquivo) throw new NotFoundException('Arquivo não encontrado');

    await this.ingestaoService.remover(id);
    return { removido: true };
  }
}
