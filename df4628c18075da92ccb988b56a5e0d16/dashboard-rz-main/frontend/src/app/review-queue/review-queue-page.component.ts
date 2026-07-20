import { Component, OnInit } from '@angular/core';
import { ReviewQueueService } from './data-access/review-queue.service';
import {
  Colaborador,
  ContagemPendentes,
  ResponsavelAtivo,
  ResponsavelNaoMapeado,
  ReviewQueueGrupo,
  SugestaoColaborador,
} from './models/review-queue.model';

interface LinhaEstado {
  grupo: ReviewQueueGrupo;
  sugestoes: SugestaoColaborador[];
  carregandoSugestoes: boolean;
  employeeIdSelecionado: number | null;
  modoNovoFuncionario: boolean;
  novoNome: string;
  novoDepartamento: string;
  processando: boolean;
  erro: string | null;
}

interface LinhaResponsavelEstado {
  item: ResponsavelNaoMapeado;
  nomeCanonicoSelecionado: string; // '' = nenhum escolhido, '__novo__' = modo novo funcionario
  novoNome: string;
  novoDepartamento: string;
  processando: boolean;
  erro: string | null;
}

const NOVO_FUNCIONARIO = '__novo__';

@Component({
  selector: 'app-review-queue-page',
  templateUrl: './review-queue-page.component.html',
  styleUrls: ['./review-queue-page.component.scss'],
})
export class ReviewQueuePageComponent implements OnInit {
  linhas: LinhaEstado[] = [];
  contagem: ContagemPendentes = { grupos: 0, linhas: 0 };
  carregando = false;
  filtroDepartamento = '';
  ultimaMensagem: string | null = null;

  linhasResponsaveis: LinhaResponsavelEstado[] = [];
  ativos: ResponsavelAtivo[] = [];
  carregandoResponsaveis = false;
  readonly NOVO_FUNCIONARIO = NOVO_FUNCIONARIO;

  colaboradores: Colaborador[] = [];
  carregandoColaboradores = false;
  filtroNomeColaborador = '';
  processandoColaboradorId: number | null = null;
  mesclarAlvoPorId: Record<number, number | null> = {};

  constructor(private readonly reviewQueueService: ReviewQueueService) {}

  ngOnInit(): void {
    this.carregar();
    this.carregarResponsaveis();
    this.carregarColaboradores();
  }

  carregar(): void {
    this.carregando = true;
    this.reviewQueueService.listar(this.filtroDepartamento || undefined).subscribe((grupos) => {
      this.linhas = grupos.map((grupo) => this.paraLinhaEstado(grupo));
      this.carregando = false;
      this.atualizarContagem();
      for (const linha of this.linhas) this.carregarSugestoes(linha);
    });
  }

  private paraLinhaEstado(grupo: ReviewQueueGrupo): LinhaEstado {
    return {
      grupo,
      sugestoes: [],
      carregandoSugestoes: false,
      employeeIdSelecionado: null,
      modoNovoFuncionario: false,
      novoNome: grupo.rawName,
      novoDepartamento: grupo.rawDept,
      processando: false,
      erro: null,
    };
  }

  private atualizarContagem(): void {
    this.reviewQueueService.contar().subscribe((c) => (this.contagem = c));
  }

  carregarSugestoes(linha: LinhaEstado): void {
    linha.carregandoSugestoes = true;
    this.reviewQueueService.sugestoes(linha.grupo.id).subscribe({
      next: (sugestoes) => {
        linha.sugestoes = sugestoes;
        linha.carregandoSugestoes = false;
        if (sugestoes.length > 0) linha.employeeIdSelecionado = sugestoes[0].employeeId;
      },
      error: () => {
        linha.carregandoSugestoes = false;
      },
    });
  }

  alternarNovoFuncionario(linha: LinhaEstado): void {
    linha.modoNovoFuncionario = !linha.modoNovoFuncionario;
    linha.erro = null;
  }

  aprovar(linha: LinhaEstado): void {
    linha.erro = null;

    if (linha.modoNovoFuncionario) {
      if (!linha.novoNome.trim() || !linha.novoDepartamento.trim()) {
        linha.erro = 'Preencha nome e departamento do novo funcionário.';
        return;
      }
      linha.processando = true;
      this.reviewQueueService.novoFuncionario(linha.grupo.id, linha.novoNome.trim(), linha.novoDepartamento.trim()).subscribe({
        next: (resultado) => this.aoAprovar(linha, resultado.canonicalName, resultado.linhasAprovadas),
        error: (err) => this.aoFalhar(linha, err),
      });
      return;
    }

    if (!linha.employeeIdSelecionado) {
      linha.erro = 'Escolha um funcionário nas sugestões ou crie um novo.';
      return;
    }
    linha.processando = true;
    this.reviewQueueService.aprovar(linha.grupo.id, linha.employeeIdSelecionado).subscribe({
      next: (resultado) => this.aoAprovar(linha, resultado.canonicalName, resultado.linhasAprovadas),
      error: (err) => this.aoFalhar(linha, err),
    });
  }

  rejeitar(linha: LinhaEstado): void {
    const confirmado = confirm(`Rejeitar "${linha.grupo.rawName}"? O nome não vira alias e as linhas pendentes ficam de fora do dashboard.`);
    if (!confirmado) return;

    linha.processando = true;
    linha.erro = null;
    this.reviewQueueService.rejeitar(linha.grupo.id).subscribe({
      next: (resultado) => {
        this.removerLinha(linha);
        this.ultimaMensagem = `"${linha.grupo.rawName}" rejeitado (${resultado.linhasRejeitadas} linha(s) descartadas).`;
        this.atualizarContagem();
      },
      error: (err) => this.aoFalhar(linha, err),
    });
  }

  private aoAprovar(linha: LinhaEstado, canonicalName: string, linhasAprovadas: number): void {
    this.removerLinha(linha);
    this.ultimaMensagem = `"${linha.grupo.rawName}" associado a "${canonicalName}" — ${linhasAprovadas} linha(s) gravadas em fact_performance e já refletidas no dashboard.`;
    this.atualizarContagem();
  }

  private aoFalhar(linha: LinhaEstado, err: any): void {
    linha.processando = false;
    linha.erro = err?.error?.message ?? 'Falha ao processar. Tente novamente.';
  }

  private removerLinha(linha: LinhaEstado): void {
    this.linhas = this.linhas.filter((l) => l !== linha);
  }

  carregarResponsaveis(): void {
    this.carregandoResponsaveis = true;
    this.reviewQueueService.listarResponsaveisAtivos().subscribe((ativos) => (this.ativos = ativos));
    this.reviewQueueService.listarResponsaveisNaoMapeados().subscribe((itens) => {
      this.linhasResponsaveis = itens.map((item) => ({
        item,
        nomeCanonicoSelecionado: '',
        novoNome: item.rawResponsavelS3d,
        novoDepartamento: '',
        processando: false,
        erro: null,
      }));
      this.carregandoResponsaveis = false;
    });
  }

  vincularResponsavel(linha: LinhaResponsavelEstado): void {
    linha.erro = null;

    if (linha.nomeCanonicoSelecionado === this.NOVO_FUNCIONARIO) {
      if (!linha.novoNome.trim() || !linha.novoDepartamento.trim()) {
        linha.erro = 'Preencha nome e departamento do novo funcionário.';
        return;
      }
      linha.processando = true;
      this.reviewQueueService
        .vincularResponsavel(linha.item.rawResponsavelS3d, linha.novoNome.trim(), linha.novoDepartamento.trim())
        .subscribe({
          next: (resultado) => this.aoVincular(linha, resultado.nomeCanonico, resultado.linhasReprocessadas),
          error: (err) => this.aoFalharResponsavel(linha, err),
        });
      return;
    }

    if (!linha.nomeCanonicoSelecionado) {
      linha.erro = 'Escolha um funcionário ou crie um novo.';
      return;
    }
    linha.processando = true;
    this.reviewQueueService.vincularResponsavel(linha.item.rawResponsavelS3d, linha.nomeCanonicoSelecionado).subscribe({
      next: (resultado) => this.aoVincular(linha, resultado.nomeCanonico, resultado.linhasReprocessadas),
      error: (err) => this.aoFalharResponsavel(linha, err),
    });
  }

  descartarResponsavel(linha: LinhaResponsavelEstado): void {
    const confirmado = confirm(
      `Descartar "${linha.item.rawResponsavelS3d}"? Deixa de contar no ranking por pessoa, mas as ${linha.item.ocorrencias} tarefa(s) continuam nos totais gerais do dashboard.`,
    );
    if (!confirmado) return;

    linha.processando = true;
    linha.erro = null;
    this.reviewQueueService.descartarResponsavel(linha.item.rawResponsavelS3d).subscribe({
      next: (resultado) => {
        this.removerLinhaResponsavel(linha);
        this.ultimaMensagem = `"${linha.item.rawResponsavelS3d}" descartado (${resultado.linhasReprocessadas} linha(s) fora do ranking por pessoa, mas seguem nos totais gerais).`;
      },
      error: (err) => this.aoFalharResponsavel(linha, err),
    });
  }

  private aoVincular(linha: LinhaResponsavelEstado, nomeCanonico: string, linhasReprocessadas: number): void {
    this.removerLinhaResponsavel(linha);
    this.ultimaMensagem = `"${linha.item.rawResponsavelS3d}" vinculado a "${nomeCanonico}" — ${linhasReprocessadas} linha(s) já refletidas no dashboard.`;
    if (!this.ativos.some((a) => a.nomeCanonico === nomeCanonico)) {
      this.carregarResponsaveis();
    }
  }

  private aoFalharResponsavel(linha: LinhaResponsavelEstado, err: any): void {
    linha.processando = false;
    linha.erro = err?.error?.message ?? 'Falha ao processar. Tente novamente.';
  }

  private removerLinhaResponsavel(linha: LinhaResponsavelEstado): void {
    this.linhasResponsaveis = this.linhasResponsaveis.filter((l) => l !== linha);
  }

  carregarColaboradores(): void {
    this.carregandoColaboradores = true;
    this.reviewQueueService.listarColaboradores().subscribe((colaboradores) => {
      this.colaboradores = colaboradores;
      this.carregandoColaboradores = false;
    });
  }

  get colaboradoresFiltrados(): Colaborador[] {
    const termo = this.filtroNomeColaborador.trim().toLowerCase();
    if (!termo) return this.colaboradores;
    return this.colaboradores.filter((c) => c.nome.toLowerCase().includes(termo));
  }

  alternarStatusColaborador(colaborador: Colaborador): void {
    const novoStatus = colaborador.status === 'ativo' ? 'inativo' : 'ativo';
    const confirmado = confirm(
      novoStatus === 'inativo'
        ? `Marcar "${colaborador.nome}" como ex-funcionário? Some do ranking/gráficos por pessoa; os registros históricos continuam existindo.`
        : `Marcar "${colaborador.nome}" como ativo de novo?`,
    );
    if (!confirmado) return;

    this.processandoColaboradorId = colaborador.id;
    this.reviewQueueService.atualizarStatusColaborador(colaborador.id, novoStatus).subscribe({
      next: (atualizado) => {
        colaborador.status = atualizado.status;
        this.processandoColaboradorId = null;
        this.ultimaMensagem = `"${colaborador.nome}" marcado como ${novoStatus}.`;
      },
      error: () => {
        this.processandoColaboradorId = null;
      },
    });
  }

  mesclarColaborador(duplicado: Colaborador): void {
    const canonicoId = this.mesclarAlvoPorId[duplicado.id];
    if (!canonicoId) return;
    const canonico = this.colaboradores.find((c) => c.id === canonicoId);
    if (!canonico) return;

    const confirmado = confirm(
      `Mesclar "${duplicado.nome}" em "${canonico.nome}"? Todo o histórico (produtividade, performance, entregas, atendimento) de "${duplicado.nome}" passa a contar pra "${canonico.nome}", e "${duplicado.nome}" vira ex-funcionário. Não dá pra desfazer sozinho.`,
    );
    if (!confirmado) return;

    this.processandoColaboradorId = duplicado.id;
    this.reviewQueueService.mesclarColaborador(duplicado.id, canonicoId).subscribe({
      next: (resultado) => {
        duplicado.status = 'inativo';
        this.processandoColaboradorId = null;
        delete this.mesclarAlvoPorId[duplicado.id];
        this.ultimaMensagem = `"${duplicado.nome}" mesclado em "${canonico.nome}" — ${resultado.linhasReatribuidas} linha(s) reatribuídas.`;
      },
      error: (err) => {
        this.processandoColaboradorId = null;
        this.ultimaMensagem = err?.error?.message ?? 'Falha ao mesclar. Tente novamente.';
      },
    });
  }
}
