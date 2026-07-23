import { IsIn, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { ConferenciaStatus } from '../conferencia.model';

export class AtualizarConferenciaItemDto {
  @IsIn(['pendente', 'ok', 'divergencia', 'nao_verificavel'])
  status!: ConferenciaStatus;

  // ValidateIf faz os decorators abaixo so rodarem quando status='divergencia' -
  // fora disso o campo e livre (undefined passa sem checagem nenhuma).
  @ValidateIf((o) => o.status === 'divergencia')
  @IsString()
  @IsNotEmpty({ message: 'Observação é obrigatória quando o status é divergência' })
  observacao?: string;
}
