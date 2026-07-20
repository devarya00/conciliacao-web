import { Component, OnInit } from '@angular/core';
import { UsuariosService } from './data-access/usuarios.service';
import { Usuario, UsuarioRole } from './models/usuario.model';

@Component({
  selector: 'app-usuarios-page',
  templateUrl: './usuarios-page.component.html',
  styleUrls: ['./usuarios-page.component.scss'],
})
export class UsuariosPageComponent implements OnInit {
  usuarios: Usuario[] = [];
  email = '';
  role: UsuarioRole = 'user';
  criando = false;
  erro: string | null = null;

  /** id do usuário com link recém-gerado, pra mostrar a caixa de copiar embaixo da linha dele */
  linkGeradoParaId: number | null = null;
  linkGerado: string | null = null;
  linkExpiraEm: string | null = null;
  copiado = false;

  constructor(private readonly usuariosService: UsuariosService) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.usuariosService.listar().subscribe((u) => (this.usuarios = u));
  }

  criar(): void {
    if (!this.email) return;
    this.criando = true;
    this.erro = null;

    this.usuariosService.criar(this.email, this.role).subscribe({
      next: (res) => {
        this.criando = false;
        this.email = '';
        this.role = 'user';
        this.carregar();
        this.mostrarLink(res.usuario.id, res.link.token, res.link.expiraEm);
      },
      error: (err) => {
        this.criando = false;
        this.erro = err?.error?.message ?? 'Falha ao criar usuário.';
      },
    });
  }

  gerarLink(usuario: Usuario): void {
    this.usuariosService.gerarLinkRedefinicao(usuario.id).subscribe((link) => {
      this.mostrarLink(usuario.id, link.token, link.expiraEm);
    });
  }

  copiarLink(): void {
    if (!this.linkGerado) return;
    navigator.clipboard.writeText(this.linkGerado).then(() => {
      this.copiado = true;
      setTimeout(() => (this.copiado = false), 2000);
    });
  }

  private mostrarLink(usuarioId: number, token: string, expiraEm: string): void {
    const url = `${window.location.origin}${window.location.pathname}?reset=${token}`;
    this.linkGeradoParaId = usuarioId;
    this.linkGerado = url;
    this.linkExpiraEm = expiraEm;
    this.copiado = false;
  }
}
