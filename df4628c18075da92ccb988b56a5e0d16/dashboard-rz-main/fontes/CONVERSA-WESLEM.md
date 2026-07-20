# Conversa com o Weslem — requisitos "na fonte"

> Transcrição condensada do chat do Teams (Weslem R Silva × Natália, jun–jul/2026), usada para
> derivar o que a plataforma precisa fazer. `WES` = Weslem (cliente/idealizador), `NAT` = Natália (dev).
> O Weslem escreve rápido e com erros; abaixo está **o que ele quis dizer**, não o literal.

## 1. O pedido inicial (o "brief")

O Weslem abriu a conversa listando, em mensagens soltas, as 4 entregas da "plataforma":

1. **Análise de tarefas** entregues, pendentes e justificadas.
2. **Tarefas entregues com cálculo de premiação** (bonificação por pontos).
3. **Gráfico de atendimento.**
4. **Gráfico de produtividade.**

> WES: "voce acha que vai mais ou menos 1 semana para conseguirmos colocar essa plataforma para rodar?"
> NAT: "Infelizmente não, umas 3 semanas. Não dá pra fazer rápido e mal feito, tem que ter segurança
> de que ela não vai falhar e deixar alguém na mão." → prazo acordado ~3 semanas, com testes antes.

**Como a plataforma é alimentada:** WES: "alimentação de todos é por planilha. Excel e CSV.
API podemos ver se conseguimos depois." → **hoje é 100% por planilha/CSV; API fica para o futuro.**

## 2. Os sistemas de origem (como o Weslem os chama)

Ele mandou as planilhas explicando de onde saem:

- **Acessórias** = "sistema de gestão de tarefas" → relatório de tarefas (entregues/pendentes/justificadas)
  e base dos pontos. → `S3D_gestao_de_entregas`.
- **Onvio** = "sistema de gestão de atendimento" → **são duas planilhas**:
  - "de atendimento, quantidade e etc" → `estatisticas-funcionários`.
  - "outra de quantidade de satisfação" → `estatisticas-satisfação`.
- **Work monitor** = "controle de produtividade" (monitoramento de tela) → `Workmonitor_performance`
  (+ o analítico de jornada `export_analitico`).
- **Legenda de tarefas** = "planilha que atualizamos sempre que criamos tarefas novas" → `LEGENDA TAREFAS.xlsx`.
- **Controle que ele fazia na mão** = `CONTROLE DE PRODUT. ATENDI.xlsx` (planilha + fórmulas do prêmio).

## 3. A regra da premiação (o ponto mais importante e mais escorregadio)

Reconstruída das mensagens dele:

- Cada **tarefa** tem uma pontuação por **dificuldade** (FÁCIL/DIFÍCIL/COMPLEXA → pontos). Essa tabela é a
  **Legenda de Tarefas**, mantida pela **Fernanda** e atualizada **só quando criam uma tarefa nova**
  (não é diária). WES: "temos uma planilha que atualizamos sempre que criamos tarefas novas."
- Cada **atendimento** (Onvio) vale **3 pontos**; se a avaliação for **"muito satisfeito"**, aquele
  atendimento passa a valer **5 pontos**. WES: "atendimento vale 3 ponto, com avaliação como muito
  satisfeito passa a valer 5 o atendimento."
- **Prêmio (R$) = (pontos das tarefas + pontos dos atendimentos) × R$ 0,18.** Valor por ponto é
  **fixo/estático**. WES: "número de pontos somados x R$0,18 — tanto pontos das tarefas quanto de atendimentos."
  *(Confere com a planilha dele: em dez/2025, 264 pontos → R$47,52 = 264×0,18. Em dados antigos de 2023
  o valor por ponto era R$0,10 — mudou ao longo do tempo.)*
- **Atendimento e tarefas são contagens separadas** — WES: "planilhas de atendimento é um controle a parte
  dos dados das tarefas, eles não têm ligação; ali é só a contagem de atendimento × 3 pontos." Elas só se
  encontram no **total de pontos** que entra no prêmio.

## 4. Decisões / mudanças que ele comunicou (afetam a modelagem)

- **Nomes de colaborador em vez de departamento.** O relatório antigo da Acessórias trazia só o
  **departamento** que fez a tarefa (não a pessoa). Nesta semana eles **trocaram os nomes dos
  departamentos pelos nomes dos colaboradores**. WES: "creio que não iremos precisar de planilha de
  legenda de usuários... vou gerar novo relatório de tarefas da acessórias que já vem com o nome de cada um."
  → **Usar o S3D novo (16/07, com nomes); a "legenda de usuários" foi descontinuada.** A legenda de
  **pontos por tarefa** continua necessária.
- **Satisfação** tem nome do colaborador ("Atendido por"); a de **tarefas** tinha só departamento — foi
  por isso que ele migrou para nomes, pra conseguir cruzar as duas pelo colaborador.
- **Workmonitor é por dia útil.** WES: "7, 14, 21 e 28 (jun) não teremos, pois não são dias úteis."
  Ele tem relatório **por dia** e **por período**; para bater com o gráfico-exemplo, usar **por dia**.
- Existe um `Dep. Fiscal e Contábil.5` no relatório da Acessórias que ainda precisava ser **vinculado a
  um colaborador** (resíduo da migração departamento→nome).

## 5. O que NÃO é requisito (ruído do chat)

Boa parte das mensagens finais é operacional e não entra no produto: pagamento de uma assinatura de
teste (~US$10,60 / "50 reais para testar"), AnyDesk/EnyDesk para acesso remoto, ponto eletrônico das
funcionárias, áudios sobre fone de ouvido. Ignorar para fins de modelagem.

---

### TL;DR para quem for desenvolver
Plataforma = **1 painel** que consolida **4 fontes de planilha** (Acessórias, Onvio×2, Workmonitor) e
entrega **4 saídas** (tarefas entregues/pendentes/justificadas, **prêmio = pontos×R$0,18**, gráfico de
atendimento, gráfico de produtividade). Chave de junção entre fontes = **nome do colaborador**
(`nome_key`). Ver `README.md` desta pasta para o mapa fonte→uso e cada subpasta para o detalhe de coluna.
