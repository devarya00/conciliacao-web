import { Component } from '@angular/core';
import { AuthService } from '../data-access/auth.service';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.scss'],
})
export class LoginPageComponent {
  email = '';
  senha = '';
  carregando = false;
  erro: string | null = null;

  constructor(private readonly auth: AuthService) {}

  entrar(): void {
    if (!this.email || !this.senha) return;
    this.carregando = true;
    this.erro = null;
    this.auth.login(this.email, this.senha).subscribe({
      next: () => {
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.erro = 'Email ou senha inválidos.';
      },
    });
  }
}
