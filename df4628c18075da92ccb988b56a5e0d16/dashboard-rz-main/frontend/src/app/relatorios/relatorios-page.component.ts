import { Component, OnInit } from '@angular/core';
import { RelatoriosService } from './data-access/relatorios.service';
import { RelatorioGerado, RelatorioStatus } from './models/relatorio.model';

const STATUS_LABEL: Record<RelatorioStatus, string> = {
  processando: 'Processando',
  aguardando_conferencia: 'Aguardando conferência',
  processando_final: 'Gerando relatório final',
  concluido: 'Concluído',
  erro: 'Erro',
};

@Component({
  selector: 'app-relatorios-page',
  templateUrl: './relatorios-page.component.html',
  styleUrls: ['./relatorios-page.component.scss'],
})
export class RelatoriosPageComponent implements OnInit {
  relatorios: RelatorioGerado[] = [];
  nomeEmpresa = '';
  competencia = '';
  balancete: File | null = null;
  resumo: File | null = null;
  gerando = false;
  erro: string | null = null;
  expandido: Record<number, boolean> = {};

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
    return !!this.nomeEmpresa && !!this.competencia && !!this.balancete && !!this.resumo && !this.gerando;
  }

  gerar(): void {
    if (!this.podeGerar()) return;
    this.gerando = true;
    this.erro = null;

    this.relatoriosService.gerar(this.nomeEmpresa, this.competencia, this.balancete!, this.resumo!).subscribe({
      next: () => {
        this.gerando = false;
        this.nomeEmpresa = '';
        this.competencia = '';
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

  /** Conferência só existe a partir do momento que a Fase 1 (extração) terminou. */
  temConferencia(relatorio: RelatorioGerado): boolean {
    return relatorio.status !== 'processando' && relatorio.status !== 'erro';
  }

  toggleExpandir(relatorio: RelatorioGerado): void {
    this.expandido[relatorio.id] = !this.expandido[relatorio.id];
  }

  onFinalGerado(): void {
    this.carregar();
  }

  statusLabel(status: RelatorioStatus): string {
    return STATUS_LABEL[status];
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

  baixarPdf(relatorio: RelatorioGerado): void {
    this.relatoriosService.baixarPdf(relatorio.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${relatorio.nome_empresa}.pdf`;
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
