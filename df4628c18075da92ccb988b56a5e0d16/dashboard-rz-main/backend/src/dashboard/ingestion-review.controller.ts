import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { EmployeeResolutionService } from './ingestao/employee-resolution.service';
import {
  ApproveReviewDto,
  ContagemPendentesDto,
  NewEmployeeReviewDto,
  ReviewQueueGrupoDto,
  SugestaoColaboradorDto,
} from './dto/ingestion-review.dto';
import { Roles } from '../auth/roles.decorator';

@Roles('admin')
@Controller('ingestion/review')
export class IngestionReviewController {
  constructor(private readonly employeeResolutionService: EmployeeResolutionService) {}

  @Get()
  listar(
    @Query('departamento') departamento?: string,
    @Query('sourceFile') sourceFile?: string,
  ): Promise<ReviewQueueGrupoDto[]> {
    return this.employeeResolutionService.listPendentesAgrupado({ departamento, sourceFile });
  }

  @Get('count')
  contar(): Promise<ContagemPendentesDto> {
    return this.employeeResolutionService.contarPendentes();
  }

  @Get(':id/suggestions')
  sugestoes(@Param('id', ParseIntPipe) id: number): Promise<SugestaoColaboradorDto[]> {
    return this.employeeResolutionService.suggestions(id);
  }

  @Post(':id/approve')
  aprovar(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveReviewDto) {
    return this.employeeResolutionService.approve(id, dto.employeeId);
  }

  @Post(':id/reject')
  rejeitar(@Param('id', ParseIntPipe) id: number) {
    return this.employeeResolutionService.reject(id);
  }

  @Post(':id/new-employee')
  novoFuncionario(@Param('id', ParseIntPipe) id: number, @Body() dto: NewEmployeeReviewDto) {
    return this.employeeResolutionService.newEmployee(id, dto.canonicalName, dto.departamento);
  }
}
