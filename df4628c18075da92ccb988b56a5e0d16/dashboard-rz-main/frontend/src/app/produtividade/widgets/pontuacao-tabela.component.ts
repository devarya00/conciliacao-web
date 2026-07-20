import { Component, OnInit } from '@angular/core';
import { DashboardService } from '../data-access/dashboard.service';
import { Ranking } from '../models/dashboard.model';

interface TotalGeral {
  pontosTotal: number;
  premio: number;
  atendimentosMuitoSatisfeito: number;
  entregasConcluidas: number;
  entregasAbertas: number;
}

const TOTAL_ZERADO: TotalGeral = {
  pontosTotal: 0,
  premio: 0,
  atendimentosMuitoSatisfeito: 0,
  entregasConcluidas: 0,
  entregasAbertas: 0,
};

@Component({
  selector: 'app-pontuacao-tabela',
  templateUrl: './pontuacao-tabela.component.html',
  styleUrls: ['./pontuacao-tabela.component.scss'],
})
export class PontuacaoTabelaComponent implements OnInit {
  readonly meses = [
    { valor: 1, nome: 'Janeiro' }, { valor: 2, nome: 'Fevereiro' }, { valor: 3, nome: 'Março' },
    { valor: 4, nome: 'Abril' }, { valor: 5, nome: 'Maio' }, { valor: 6, nome: 'Junho' },
    { valor: 7, nome: 'Julho' }, { valor: 8, nome: 'Agosto' }, { valor: 9, nome: 'Setembro' },
    { valor: 10, nome: 'Outubro' }, { valor: 11, nome: 'Novembro' }, { valor: 12, nome: 'Dezembro' },
  ];

  mesSelecionado = new Date().getMonth() + 1;
  anoSelecionado = new Date().getFullYear();
  carregando = false;

  linhas: Ranking[] = [];
  total: TotalGeral = TOTAL_ZERADO;

  constructor(private readonly dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    const mes = String(this.mesSelecionado).padStart(2, '0');
    const dataInicial = `${this.anoSelecionado}-${mes}-01`;
    const ultimoDia = new Date(this.anoSelecionado, this.mesSelecionado, 0).getDate();
    const dataFinal = `${this.anoSelecionado}-${mes}-${String(ultimoDia).padStart(2, '0')}`;

    this.carregando = true;
    this.dashboardService.ranking({ dataInicial, dataFinal }).subscribe({
      next: (ranking) => {
        this.carregando = false;
        this.linhas = [...ranking].sort((a, b) => b.pontosTotal - a.pontosTotal);
        this.total = this.linhas.reduce(
          (acc, l) => ({
            pontosTotal: acc.pontosTotal + l.pontosTotal,
            premio: acc.premio + l.premio,
            atendimentosMuitoSatisfeito: acc.atendimentosMuitoSatisfeito + l.atendimentosMuitoSatisfeito,
            entregasConcluidas: acc.entregasConcluidas + l.entregasConcluidas,
            entregasAbertas: acc.entregasAbertas + l.entregasAbertas,
          }),
          TOTAL_ZERADO,
        );
      },
      error: () => {
        this.carregando = false;
        this.linhas = [];
        this.total = TOTAL_ZERADO;
      },
    });
  }
}
