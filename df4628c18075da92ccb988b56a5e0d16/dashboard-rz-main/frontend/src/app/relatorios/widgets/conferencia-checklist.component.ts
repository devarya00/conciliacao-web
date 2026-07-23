import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ConferenciaService } from '../data-access/conferencia.service';
import { ConferenciaItem, ConferenciaResponse, ConferenciaStatus } from '../models/conferencia.model';

const ROTULOS: Record<ConferenciaStatus, string> = {
  ok: 'OK',
  divergencia: 'Divergência',
  nao_verificavel: 'Não verificável',
  pendente: 'Pendente',
};

@Component({
  selector: 'app-conferencia-checklist',
  templateUrl: './conferencia-checklist.component.html',
  styleUrls: ['./conferencia-checklist.component.scss'],
})
export class ConferenciaChecklistComponent implements OnChanges {
  @Input() relatorioId!: number;
  @Output() finalGerado = new EventEmitter<void>();

  conferencia: ConferenciaResponse | null = null;
  carregando = false;
  erro: string | null = null;
  gerandoFinal = false;

  editando: Record<number, boolean> = {};
  rascunho: Record<number, { status: ConferenciaStatus; observacao: string }> = {};

  constructor(private readonly conferenciaService: ConferenciaService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['relatorioId']) this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erro = null;
    this.conferenciaService.buscar(this.relatorioId).subscribe({
      next: (c) => {
        this.conferencia = c;
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Falha ao carregar conferência.';
        this.carregando = false;
      },
    });
  }

  /** Itens com valor calculado (contábil sempre; fiscal só quando há contrapartida no resumo) - tabela compacta, à parte. */
  comparacoes(): ConferenciaItem[] {
    return this.conferencia?.itens.filter((i) => i.valorContabil !== null) ?? [];
  }

  diferenca(item: ConferenciaItem): number | null {
    if (item.valorFiscal === null || item.valorContabil === null) return null;
    return item.valorFiscal - item.valorContabil;
  }

  temDivergenciaNumerica(item: ConferenciaItem): boolean {
    const d = this.diferenca(item);
    return d !== null && Math.abs(d) > 0.01;
  }

  grupoA(): ConferenciaItem[] {
    return this.conferencia?.itens.filter((i) => i.passo.grupo === 'A' && i.valorContabil === null) ?? [];
  }

  grupoB(): ConferenciaItem[] {
    return this.conferencia?.itens.filter((i) => i.passo.grupo === 'B' && i.valorContabil === null) ?? [];
  }

  rotulo(status: ConferenciaStatus): string {
    return ROTULOS[status];
  }

  percentual(): number {
    const p = this.conferencia?.progresso;
    if (!p || p.totalAutomatizavel === 0) return 0;
    return Math.round((p.okAutomatizavel / p.totalAutomatizavel) * 100);
  }

  iniciarEdicao(item: ConferenciaItem): void {
    this.editando[item.passo.id] = true;
    this.rascunho[item.passo.id] = { status: item.status, observacao: item.observacao ?? '' };
  }

  cancelarEdicao(item: ConferenciaItem): void {
    delete this.editando[item.passo.id];
  }

  precisaObservacao(passoId: number): boolean {
    return this.rascunho[passoId]?.status === 'divergencia' && !this.rascunho[passoId]?.observacao.trim();
  }

  salvarEdicao(item: ConferenciaItem): void {
    const r = this.rascunho[item.passo.id];
    if (this.precisaObservacao(item.passo.id)) return;
    this.conferenciaService
      .atualizarItem(this.relatorioId, item.passo.id, r.status, r.observacao.trim() || undefined)
      .subscribe({
        next: (c) => {
          this.conferencia = c;
          delete this.editando[item.passo.id];
        },
        error: () => {
          this.erro = 'Falha ao salvar item.';
        },
      });
  }

  gerarFinal(): void {
    if (!this.conferencia?.podeGerarFinal || this.gerandoFinal) return;
    this.gerandoFinal = true;
    this.erro = null;
    this.conferenciaService.gerarFinal(this.relatorioId).subscribe({
      next: () => {
        this.gerandoFinal = false;
        this.finalGerado.emit();
      },
      error: (err) => {
        this.gerandoFinal = false;
        this.erro = err?.error?.message ?? 'Falha ao gerar relatório final.';
      },
    });
  }

  baixarPdf(): void {
    this.conferenciaService.baixarConferenciaPdf(this.relatorioId).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conferencia-${this.relatorioId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
