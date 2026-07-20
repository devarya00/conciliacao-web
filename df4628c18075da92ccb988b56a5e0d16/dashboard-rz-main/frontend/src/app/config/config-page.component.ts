import { Component, OnInit } from '@angular/core';
import { ConfigService } from './data-access/config.service';
import { ValorPonto } from './models/config.model';

@Component({
  selector: 'app-config-page',
  templateUrl: './config-page.component.html',
  styleUrls: ['./config-page.component.scss'],
})
export class ConfigPageComponent implements OnInit {
  readonly meses = [
    { valor: 1, nome: 'Janeiro' }, { valor: 2, nome: 'Fevereiro' }, { valor: 3, nome: 'Março' },
    { valor: 4, nome: 'Abril' }, { valor: 5, nome: 'Maio' }, { valor: 6, nome: 'Junho' },
    { valor: 7, nome: 'Julho' }, { valor: 8, nome: 'Agosto' }, { valor: 9, nome: 'Setembro' },
    { valor: 10, nome: 'Outubro' }, { valor: 11, nome: 'Novembro' }, { valor: 12, nome: 'Dezembro' },
  ];

  historico: ValorPonto[] = [];
  mesSelecionado: number | null = null;
  anoSelecionado: number | null = new Date().getFullYear();
  valorInformado: number | null = null;
  salvando = false;
  erro: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.configService.listarValorPonto().subscribe((h) => (this.historico = h));
  }

  salvar(): void {
    if (!this.mesSelecionado || !this.anoSelecionado || this.valorInformado === null) return;
    if (this.anoSelecionado < 2000 || this.anoSelecionado > 2100) {
      this.erro = 'Ano inválido.';
      return;
    }

    this.salvando = true;
    this.erro = null;
    const mes = String(this.mesSelecionado).padStart(2, '0');
    const competencia = `${this.anoSelecionado}-${mes}-01`;

    this.configService.salvarValorPonto(competencia, this.valorInformado).subscribe({
      next: () => {
        this.salvando = false;
        this.mesSelecionado = null;
        this.valorInformado = null;
        this.carregar();
      },
      error: (err) => {
        this.salvando = false;
        this.erro = err?.error?.message ?? 'Falha ao salvar valor do ponto.';
      },
    });
  }

  formatarCompetencia(competencia: string): string {
    const [ano, mes] = competencia.split('-');
    return `${mes}/${ano}`;
  }
}
