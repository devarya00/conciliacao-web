import { Component, OnInit } from '@angular/core';
import { ArquivosService } from './data-access/arquivos.service';
import { Arquivo, ORIGEM_LABEL, ORIGENS, Origem } from './models/arquivo.model';

@Component({
  selector: 'app-arquivos-page',
  templateUrl: './arquivos-page.component.html',
  styleUrls: ['./arquivos-page.component.scss'],
})
export class ArquivosPageComponent implements OnInit {
  readonly origens = ORIGENS;
  readonly origemLabel = ORIGEM_LABEL;

  arquivos: Arquivo[] = [];
  origemSelecionada: Origem = 's3d';
  enviando = false;
  erro: string | null = null;

  dataInicial: string | null = null;
  dataFinal: string | null = null;

  constructor(private readonly arquivosService: ArquivosService) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.arquivosService
      .listar({ dataInicial: this.dataInicial ?? undefined, dataFinal: this.dataFinal ?? undefined })
      .subscribe((a) => (this.arquivos = a));
  }

  limparFiltro(): void {
    this.dataInicial = null;
    this.dataFinal = null;
    this.carregar();
  }

  formatarPeriodo(arquivo: Arquivo): string {
    if (!arquivo.periodoInicio || !arquivo.periodoFim) return '—';
    if (arquivo.periodoInicio === arquivo.periodoFim) return this.formatarData(arquivo.periodoInicio);
    return `${this.formatarData(arquivo.periodoInicio)} – ${this.formatarData(arquivo.periodoFim)}`;
  }

  private formatarData(iso: string): string {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  onArquivoEscolhido(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!arquivo) return;

    this.enviando = true;
    this.erro = null;

    this.arquivosService.upload(arquivo, this.origemSelecionada).subscribe({
      next: () => {
        this.enviando = false;
        input.value = '';
        this.carregar();
      },
      error: (err) => {
        this.enviando = false;
        input.value = '';
        this.erro = err?.error?.message ?? 'Falha ao enviar arquivo.';
      },
    });
  }

  excluir(arquivo: Arquivo): void {
    const confirmado = confirm(
      `Excluir "${arquivo.nomeOriginal}"? Os ${arquivo.registros} registro(s) derivados dele serão apagados.`,
    );
    if (!confirmado) return;

    this.arquivosService.remover(arquivo.id).subscribe(() => this.carregar());
  }

  formatarTamanho(bytes: number | null): string {
    if (bytes === null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
