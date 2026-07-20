import { Body, Controller, Get, Put } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ValorPontoDto, UpsertValorPontoDto } from './dto/valor-ponto.dto';
import { Roles } from '../auth/roles.decorator';

@Roles('admin')
@Controller('dashboard/config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('valor-ponto')
  listarValorPonto(): Promise<ValorPontoDto[]> {
    return this.configService.listarValorPonto();
  }

  @Put('valor-ponto')
  upsertValorPonto(@Body() dto: UpsertValorPontoDto): Promise<ValorPontoDto> {
    return this.configService.upsertValorPonto(dto);
  }
}
