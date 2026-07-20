import { Component, OnInit } from '@angular/core';
import { RelatoriosService } from './data-access/relatorios.service';
import { RelatorioGerado } from './models/relatorio.model';

@Component({
  selector: 'app-relatorios-page',
  templateUrl: './relatorios-page.component.html',
  styleUrls: ['./relatorios-page.component.scss'],
})
export class RelatoriosPageComponent implements OnInit {
  relatorios: RelatorioGerado[] = [];
  nomeEmpresa = '';
  balancete: File | null = null;
  resumo: File | null = null;
  gerando = false;
  erro: string | null = null;

  constructor(private readonly relatoriosService: RelatoriosService) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.relatoriosService.listar().subscribe((r) => (this.relatorios = r));
  }

  onBalanceteEscolhido(event: Event): void {
    this.balancete = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  onResumoEscolhido(event: Event): void {
    this.resumo = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  podeGerar(): boolean {
    return !!this.nomeEmpresa && !!this.balancete && !!this.resumo && !this.gerando;
  }

  gerar(): void {
    if (!this.podeGerar()) return;
    this.gerando = true;
    this.erro = null;

    this.relatoriosService.gerar(this.nomeEmpresa, this.balancete!, this.resumo!).subscribe({
      next: () => {
        this.gerando = false;
        this.nomeEmpresa = '';
        this.balancete = null;
        this.resumo = null;
        this.carregar();
      },
      error: (err) => {
        this.gerando = false;
        this.erro = err?.error?.message ?? 'Falha ao gerar relatório.';
      },
    });
  }

  baixar(relatorio: RelatorioGerado): void {
    this.relatoriosService.baixar(relatorio.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${relatorio.nome_empresa}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  excluir(relatorio: RelatorioGerado): void {
    const confirmado = confirm(`Excluir relatório de "${relatorio.nome_empresa}"?`);
    if (!confirmado) return;
    this.relatoriosService.remover(relatorio.id).subscribe(() => this.carregar());
  }
}
