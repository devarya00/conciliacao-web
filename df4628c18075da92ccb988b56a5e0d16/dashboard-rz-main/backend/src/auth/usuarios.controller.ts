import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { UsuariosService, UsuarioResumo, LinkRedefinicao } from './usuarios.service';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { Roles } from './roles.decorator';
import { Public } from './public.decorator';

/** Gestão de contas — restrito a admin, exceto a redefinição de senha em si. */
@Roles('admin')
@Controller('auth/usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  listar(): Promise<UsuarioResumo[]> {
    return this.usuariosService.listar();
  }

  @Post()
  criar(@Body() dto: CriarUsuarioDto) {
    return this.usuariosService.criar(dto.email, dto.role);
  }

  @Post(':id/reset-link')
  gerarLink(@Param('id', ParseIntPipe) id: number): Promise<LinkRedefinicao> {
    return this.usuariosService.gerarLinkRedefinicao(id);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  redefinirSenha(@Body() dto: RedefinirSenhaDto): Promise<void> {
    return this.usuariosService.redefinirSenha(dto.token, dto.novaSenha);
  }
}
