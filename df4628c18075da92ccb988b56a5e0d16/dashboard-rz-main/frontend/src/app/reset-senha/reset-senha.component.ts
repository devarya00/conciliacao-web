import { Component, Input } from '@angular/core';
import { UsuariosService } from '../usuarios/data-access/usuarios.service';

@Component({
  selector: 'app-reset-senha',
  templateUrl: './reset-senha.component.html',
  styleUrls: ['./reset-senha.component.scss'],
})
export class ResetSenhaComponent {
  @Input({ required: true }) token!: string;

  novaSenha = '';
  confirmarSenha = '';
  enviando = false;
  erro: string | null = null;
  sucesso = false;

  constructor(private readonly usuariosService: UsuariosService) {}

  redefinir(): void {
    if (this.novaSenha.length < 8) {
      this.erro = 'Senha precisa ter pelo menos 8 caracteres.';
      return;
    }
    if (this.novaSenha !== this.confirmarSenha) {
      this.erro = 'As senhas não coincidem.';
      return;
    }

    this.enviando = true;
    this.erro = null;
    this.usuariosService.redefinirSenha(this.token, this.novaSenha).subscribe({
      next: () => {
        this.enviando = false;
        this.sucesso = true;
      },
      error: (err) => {
        this.enviando = false;
        this.erro = err?.error?.message ?? 'Link inválido ou expirado.';
      },
    });
  }

  irParaLogin(): void {
    window.location.href = window.location.pathname;
  }
}
