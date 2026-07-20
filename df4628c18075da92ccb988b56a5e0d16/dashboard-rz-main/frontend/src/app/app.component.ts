import { Component, OnInit } from '@angular/core';
import { ReviewQueueService } from './review-queue/data-access/review-queue.service';
import { AuthService } from './auth/data-access/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  aba: 'dashboard' | 'workmonitor' | 'arquivos' | 'config' | 'revisao' | 'relatorios' | 'usuarios' = 'dashboard';
  pendentesRevisao = 0;

  /** ?reset=TOKEN na URL — tela de redefinição de senha é pública, sem router mesmo (link externo) */
  readonly tokenRedefinicao = new URLSearchParams(window.location.search).get('reset');

  constructor(
    private readonly reviewQueueService: ReviewQueueService,
    readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.auth.usuario$.subscribe((usuario) => {
      if (usuario?.role === 'admin') this.atualizarContagemRevisao();
      else if (usuario) this.aba = 'relatorios';
    });
  }

  selecionarAba(
    aba: 'dashboard' | 'workmonitor' | 'arquivos' | 'config' | 'revisao' | 'relatorios' | 'usuarios',
  ): void {
    this.aba = aba;
    if (aba === 'revisao') this.atualizarContagemRevisao();
  }

  sair(): void {
    this.auth.logout();
  }

  private atualizarContagemRevisao(): void {
    this.reviewQueueService.contar().subscribe((c) => (this.pendentesRevisao = c.grupos));
  }
}
