import { IsIn } from 'class-validator';
import { ORIGENS, Origem } from '../ingestao/origem';

export class UploadArquivoDto {
  @IsIn(ORIGENS)
  origem: Origem;
}
