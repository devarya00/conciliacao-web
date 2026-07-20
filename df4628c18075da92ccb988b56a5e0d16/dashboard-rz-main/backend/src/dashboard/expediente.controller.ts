import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ExpedienteService } from './expediente.service';
import { CreateFeriadoDto, ExpedienteConfigDto, FeriadoDto, UpdateExpedienteDto } from './dto/expediente.dto';
import { Roles } from '../auth/roles.decorator';

@Roles('admin')
@Controller('dashboard/expediente')
export class ExpedienteController {
  constructor(private readonly expedienteService: ExpedienteService) {}

  @Get()
  getConfig(): Promise<ExpedienteConfigDto> {
    return this.expedienteService.getConfigDto();
  }

  @Put()
  updateConfig(@Body() dto: UpdateExpedienteDto): Promise<ExpedienteConfigDto> {
    return this.expedienteService.updateConfig(dto);
  }

  @Get('feriados')
  listarFeriados(): Promise<FeriadoDto[]> {
    return this.expedienteService.listarFeriados();
  }

  @Post('feriados')
  adicionarFeriado(@Body() dto: CreateFeriadoDto): Promise<FeriadoDto> {
    return this.expedienteService.adicionarFeriado(dto);
  }

  @Delete('feriados/:data')
  removerFeriado(@Param('data') data: string): Promise<void> {
    return this.expedienteService.removerFeriado(data);
  }
}
