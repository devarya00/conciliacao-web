-- Relatorio de Conferencia (auto-computado) + gate do Relatorio Final.
--
-- O gerador de relatorios passa a rodar em 2 fases: extract_pdfs.py (rapido)
-- cria o relatorio_gerado + o checklist de conferencia ja com veredito
-- calculado pra cada um dos 43 passos dos 2 procedimentos internos do
-- escritorio (Conferencia/Validacao da Integracao Contabil - grupo A, 23
-- passos - e Apuracao/Encerramento Contabil - grupo B, 20 passos). O
-- pipeline pesado (gen_xlsx.py + gen_html.py + Playwright, o "Relatorio
-- Final" de hoje) so roda depois, via /gerar-final, quando os passos
-- automatizaveis (regra_automatica preenchida) estiverem 100% 'ok'.

-- competencia estruturada (hoje so nome_empresa livre, sem periodo)
ALTER TABLE relatorio_gerado ADD COLUMN IF NOT EXISTS competencia date;

-- novo enum de status: processando (fase 1 rodando) -> aguardando_conferencia
-- (fase 1 ok, aguardando gate) -> processando_final (fase 2 rodando) ->
-- concluido; erro so pra falha na fase 1 (falha na fase 2 volta pra
-- aguardando_conferencia, ver relatorios.service.ts).
ALTER TABLE relatorio_gerado DROP CONSTRAINT IF EXISTS relatorio_gerado_status_check;
ALTER TABLE relatorio_gerado ADD CONSTRAINT relatorio_gerado_status_check
  CHECK (status IN ('processando', 'aguardando_conferencia', 'processando_final', 'concluido', 'erro'));

CREATE TABLE IF NOT EXISTS conferencia_passo (
  id                serial PRIMARY KEY,
  codigo            text NOT NULL UNIQUE,   -- 'A01'..'A23', 'B01'..'B20'
  grupo             text NOT NULL CHECK (grupo IN ('A', 'B')),
  ordem             integer NOT NULL,
  titulo            text NOT NULL,
  descricao         text,                    -- dica/sub-passos, texto do procedimento interno
  regra_automatica  text,                    -- slug calculado por conferencia_auto.py, ou NULL = sempre 'nao_verificavel'
  ativo             boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO conferencia_passo (codigo, grupo, ordem, titulo, descricao, regra_automatica) VALUES
('A01', 'A', 1, 'Acessar o sistema Domínio', $$1- Escolher o modulo contabilidade
2- Clicar com botão direito do mouse e executar como administrador$$, NULL),

('A02', 'A', 2, 'Acessar opção Relatórios', $$1-Clicar em Balancete
2-Digitar o mês inicial e final da Conferencia
3- Clicar em OK$$, NULL),

('A03', 'A', 3, 'Verificar no Balancete o Saldo anterior e Saldo Atual se estão Negativos', $$1- contas do ATIVO, os valores das contas do ativo não podem ficar com 'C' de credor na Frente do valor. (é considerado saldo negativo).
2- Contas do PASSIVO, os valores das contas do passivo não podem ficar com 'D' de Devedor na Frente do valor. (é considerado saldo negativo).
3- contas de RESULTADO - DESPESAS - CUSTOS E DEDUÇOES DA RECEITA, os valores das contas de Resultado DESPESAS - CUSTOS E DEDUÇOES DA RECEITA não podem ficar com 'C' de credor na Frente do valor. (é considerado saldo negativo).
4- contas de RESULTADO - RECEITAS BRUTAS, RECEITAS FINANCEIRAS - RECEITAS NÃO OPERACIONAL, os valores das contas não podem ficar com 'D' de devedor na Frente do valor. (é considerado saldo negativo).

OBS: Erros em conta com saldo negativos podem ser parametrização errada das contas de lançamentos no fiscal e folhas, rever parametrização da integração contábil. Implantação de saldos errados na abertura da contabilidade da empresa.$$, 'saldo_negativo_grupo'),

('A04', 'A', 4, 'Verificar se o saldo de Caixa do balancete esta Negativo', $$1- contas do ATIVO, os valores das contas do ativo não podem ficar com 'C' de credor na Frente do valor. (é considerado saldo negativo).

OBS: para corrigir o saldo negativo e zerar a conta ao valor 0,00 preciso excluir os pagamentos realizados nas contas Fornecedores do Passivo.$$, 'caixa_credor'),

('A05', 'A', 5, 'Relatório de acumulador', $$1-abrir modulo escrita Fiscal
2-Clicar em Relatório
3-Clicar em na opção Acompanhamento
4-Clicar na opção Resumo por acumulador
5-Digitar o período que Deseja confrontar com a informações contabeis.
6-Salvar em PDF na pasta do cliente na Subpasta ECD.

OBS: Neste relatório Você consegue fazer a conferencia de forma consolidada das compras (entrada/devoluções) e Vendas e serviços (saidas/devoluções)$$, NULL),

('A06', 'A', 6, '1-Verificar integração dos valores das contas contábeis - Simples Nacional', $$-Verificar se o valor foi importado no balancete no Passivo.
-Verificar se houve Pagamento automático pelo sistema.
Se não houver validar se o simples foi pago pelo cliente no E-CAC.
Caso tenha realizado o pagamento informa o pagamento no balancete.$$, 'simples_nacional_importado'),

('A07', 'A', 7, '2-Verificar integração dos valores das contas contábeis - Fornecedores', $$-Verificar se o valor foi importado no balancete no Passivo.
-Verificar se houve Pagamento das duplicatas de forma automática pelo sistema.
Se não houve o pagamento das duplicatas do fornecedor e o saldo Devedor na coluna aparece 0,00 e a empresa possui saldo de caixa, realizar o pagamento sempre deixando um valor de saldo mínimo de caixa de R$10.000,00.
-Validar o Saldo importado do balancete conta Fornecedor x Relatório de Compras (entradas) CFOP Revenda ou/e despesas.$$, 'fornecedores_x_compras'),

('A08', 'A', 8, '3-Verificar integração dos valores das contas contábeis - Estoque/Mercadorias/Produtos', $$-Verificar se o valor foi importado no balancete no ATIVO.
-Validar o Saldo importado do balancete conta Mercadoria x Relatório de Compras (entradas) CFOP Revenda.

OBS: separar notas de serviços que são despesas para serem contabilizadas para DRE e comprar de uso e consumo (material de limpeza, material de informática, material copa cozinha, Manutenções patrimoniais) para serem contabilizadas na DRE.
Compras (entradas) de imobilizados (Veículos em geral, maquinários, ferramentas, moveis e utensílios, computadores com valor de acima de 2.000,00 para serem contabilizados no ATIVO no imobilizado, valores abaixo de 2.000,00 podem ser enviados para contas de DRE.$$, 'estoque_x_compras'),

('A09', 'A', 9, '4-Verificar integração dos valores das contas contábeis - Vendas de Mercadorias/Vendas de Produtos/Prestação de serviços', $$-Verificar se o valor foi importado no balancete nas contas de Resultado.
-Validar Valor importado das Receita x Relatório de saída (CFOP de venda), Relatório de serviços prestados, Relatório de Fretes.$$, 'receita_x_vendas'),

('A10', 'A', 10, '5-Verificar integração dos valores das contas contábeis - Clientes a Receber', $$(Caso tenha NF de Venda ou serviços com recebimento a Prazo)

-Verificar se o valor foi importado no balancete no ATIVO.
-Verificar se o Recebimento dos clientes a Receber foram baixadas automaticamente.

Se não houve recebimento automático da conta clientes a receber, realizar o recebimento mensal do saldo na conta caixa ou Banco. (simples Nacional)

Se não houve recebimento automático da conta clientes a receber, realizar o recebimento mensal do saldo na conta caixa ou Banco conforme relatório de saldo de baixa de duplicatas a receber enviado pelo cliente (Presumido ou Real)$$, 'clientes_receber_importado'),

('A11', 'A', 11, '6-Verificar integração dos valores das contas contábeis - Salários e Ordenados', $$(contas de Resultado)

-Verificar se o valor foi importado na Contas de Resultado.
-Validar Valor do saldo salarios e ordenados x Resumo da Folha de Pagamento (Desconsiderar do somatório do valor total do resumo da folha o valor do pro labore e salario família, salario maternidade).

Caso tenha divergência no valor gerar Solicitação de ajuste para do DEP PESSOAL e pedir para gerar integração contábil folha novamente.$$, 'salarios_importado'),

('A12', 'A', 12, '7-Verificar integração dos valores das contas contábeis - FGTS', $$(Passivo)

-Verificar se o valor foi importado no Passivo.
-Validar Valor do saldo FGTS x Resumo da Folha de Pagamento.

Caso tenha divergência no valor gerar Solicitação de ajuste para do DEP PESSOAL e pedir para gerar integração contábil folha novamente.$$, 'fgts_importado'),

('A13', 'A', 13, '8-Verificar integração dos valores das contas contábeis - INSS', $$(PASSIVO)

-Verificar se o valor foi importado no passivo.
-Verificar se houve o Pagamento do imposto de forma automática do mês anterior, caso não tenha ocorrido, verificar junto ao e-cac a pendencias para poder fazer o pagamento da guia de forma manual.
-Validar Valor do saldo INSS x Resumo da Folha de Pagamento.

Caso tenha divergência no valor gerar Solicitação de ajuste para do DEP PESSOAL e pedir para gerar integração contábil folha novamente.$$, 'inss_importado'),

('A14', 'A', 14, '9-Verificar integração dos valores das contas contábeis - IRRF', $$(PASSIVO)

-Verificar se o valor foi importado no passivo.
-Verificar se houve o Pagamento do imposto de forma automática do mês anterior, caso não tenha ocorrido, verificar junto ao e-cac a pendencias para poder fazer o pagamento da guia de forma manual.
-Validar Valor do saldo IRRF x Resumo da Folha de Pagamento.

Caso tenha divergência no valor gerar Solicitação de ajuste para do DEP PESSOAL e pedir para gerar integração contábil folha novamente.$$, 'irrf_importado'),

('A15', 'A', 15, '10-Verificar integração dos valores das contas contábeis - Pró-labore', $$(PASSIVO)

-Verificar se o valor foi importado na Contas de Resultado.
-Verificar se houve o Pagamento do imposto de forma automática do mês anterior, caso não tenha ocorrido, fazer o pagamento de forma manual.
-Validar Valor do saldo PRO LABORE x Resumo da Folha de Pagamento.

Caso tenha divergência no valor gerar Solicitação de ajuste para do DEP PESSOAL e pedir para gerar integração contábil folha novamente$$, 'pro_labore_importado'),

('A16', 'A', 16, '11-Verificar integração dos valores das contas contábeis - Provisões de Férias, 13º salário e FGTS', $$(PASSIVO)

-Verificar se o valor foi importado no Passivo.$$, 'provisoes_importadas'),

('A17', 'A', 17, '12-Capital social', $$Toda empresa que inicia a Contabilidade deve ter o saldo (valor do Capital social) registrado no Balancete.$$, 'capital_social_existe'),

('A18', 'A', 18, '13-Capital social II', $$-Verificar se houve alguma alteração contratual dentro do mês de escrituração contábil que aumentou o capital social da empresa no contrato social.
-Caso tenha aumento no capital social Analisar no contrato social se o aumento veio do Lucro acumulado do Balanço do ano anterior ou de aplicação em dinheiro pelos sócios, aquisição de um imóvel ou etc. para realizar este lançamento no Balancete da empresa.$$, NULL),

('A19', 'A', 19, '14-DRE - Custo', $$Atividade de Comercio/Industria
CMV-custo de Mercadoria Vendida (comercio)
CPV-Custo do produto vendido (indústria)

Para empresas simples nacional utilizar um custo de 46% x o Valor de Venda do mês e lançar nesta conta contábil.
Para empresas lucro presumido e Real solicitar para o cliente o relatório do custo da mercadoria vendida para lançar nesta conta contábil.

Atividade de prestação de serviço
CSP-custo do serviço prestado

Lançar nesta conta gastos com energia elétrica, agua, aluguel, insumos utilizados na prestação de serviços, combustível.$$, NULL),

('A20', 'A', 20, '15-DRE - Custos II', $$1-Observar se os Custos apropriados na DRE condizem com a Atividades existentes do cliente.
CMV- custo da mercadoria vendida - atividade de comercio
CPV- Custo do produto vendido - Atividade industrial/fabricantes
CSP-Custo do serviço prestado - Prestação de serviços.

Exemplo: Atividade Comercio deve ter na DRE como Custo da Mercadoria vendida - CMV, caso tenha o custo registrado como CSP- custo do serviço prestado ou valores em Custo do produto vendido - CPV, os valores estão alocado no custo errado e deve ser corrigido.$$, NULL),

('A21', 'A', 21, '16-Apropriação de Impostos Fiscais e Sociais', $$No mes de Dezembro do ano que será lançado no qual existe as apropriações dos impostos fiscais e sociais do mes, este Valor deve conter no Balanço Patrimonial para serem liquidados no Mes de janeiro do próximo Ano.$$, NULL),

('A22', 'A', 22, '17-Verificar estrutura da DRE', $$Caso alguma conta contabil este fora desta Estrutura deve Ser corrigido no Plano de Conta da empresa no Modulo Contabil

DRE
Receita Bruta Operacional
-vendas
-serviços
Deduções da Receita
-devoluções
-vendas canceladas
-descontos concedidos
-Impostos (simples, ISS, PIS, Cofins e ICMS, IPI)
=Receita
Custos - CMV, CPV ou CSP
=Receita
Despesa operacional
-despesa comercial
-despesa administrativa
-Despesa Financeira
Receita liquida operacional
Receita não operacional
despesa não operacional
Receita Financeira
Lucro antes do IR
Provisão o IRPJ
Provisão CSLl
Distribuição de dividendos
distribuição de lucro
Lucro liquido do exercicio.$$, 'estrutura_balanco'),

('A23', 'A', 23, '18-Verificar integração dos valores das contas contábeis - Receita Bruta de Venda ou Serviços', $$Gerar o relatório
1-abrir modulo escrita Fiscal
2-Clicar em Relatório
3-Clicar em na opção Acompanhamento
4-Clicar na opção Resumo por acumulador
5-Digitar o período que Deseja confrontar com a informações contabeis.
6-Salvar em PDF na pasta do cliente na Subpasta ECD.

Verificar se o valor de Total de vendas Deduzindo Remessas (outras saídas) esta igual ao Valor de venda ou serviços da DRE no modulo contabilidade.$$, 'receita_x_vendas'),

('B01', 'B', 1, 'Abrir Navegador da Internet', $$Clicar no endereço da Domínio web.
https://www.dominioweb.com.br/$$, NULL),

('B02', 'B', 2, 'Digitar seu usuário e senha do Portal do cliente e clicar em entrar', NULL, NULL),

('B03', 'B', 3, 'Clicar em Entrar', NULL, NULL),

('B04', 'B', 4, 'Escolher e Clicar sobre o Modulo CONTABILIDADE', NULL, NULL),

('B05', 'B', 5, 'Digitar seu Usuário e senha de acesso ao Módulos da domínio e clicar OK', NULL, NULL),

('B06', 'B', 6, 'Emitir Plano de conta contábil para facilitar Verificação dos códigos das contas contábeis', $$1-Clicar na opção Utilitários
2-Clicar na opção Exportação
3-Clicar na Opção contas
4-Caminho do sua maquina deixar como M:
5-Clicar em Exportar$$, NULL),

('B07', 'B', 7, 'Criar contas contábeis de Fornecedores e Clientes', $$1-Acessar modulo escrita Fiscal
2-Clicar em utilitários
3-Clicar na opção Alterar cadastro de fornecedores / clientes.
4-Clicar em gerar contas Patrimoniais.
5-Marcar clientes e clicar em Lista
Caso todos clientes tenha conta emitirá um aviso de alerta, só clicar OK
Caso tenha contas a ser criadas, Marcar todos e clicar em gerar conta.
Clicar em Gravar
6-Marcar todos fornecedores e clicar em listar
Caso todos clientes tenha conta emitirá um aviso de alerta, só clicar OK
Caso tenha contas a ser criadas, Marcar todos e clicar em gerar conta.
Clicar em Gravar$$, NULL),

('B08', 'B', 8, 'Gerar Parcelas de Fornecedores e Clientes - Saídas', $$1-Acessar modulo escrita fiscal
2-Clicar em Utilitários
3-Ciclar em parcelas
4-Clicar em entradas
5-Deixar marcado listar somente notas sem parcelas
6-Clicar em Busca avançada e coluna colocar por emissão, na condição colocar entre e digitar o período que deseja consultar
7-Clicar ok
8- Na conferencia precisamos observar se possui CFOP Devolução 1.202 e 1411, remessa 1.949 e 2949, 1915, 1916, 1.904, pois este CFOP não devem ser marcado para gerar parcelas.
9-Demais CFOP devem ser marcados para gerar parcelas.
10-Clicar Gerar.
11- deixar marcado somente Notas selecionadas
12- Vencimento colocar Informar
13-Quantidade deixar 30 dias
14-Clicar em gerar
15-Msn clicar em Yes$$, NULL),

('B09', 'B', 9, 'Gerar Parcelas de Fornecedores e Clientes - Entradas', $$1-Acessar modulo escrita fiscal
2-Clicar em Utilitários
3-Ciclar em parcelas
4-Clicar em entradas
5-Deixar marcado listar somente notas sem parcelas
6-Clicar em Busca avançada e coluna colocar por emissão, na condição colocar entre e digitar o período que deseja consultar
7-Clicar ok
8- Na conferencia precisamos observar se possui CFOP Devolução 1.202 e 1411, remessa 1.949 e 2949, 1915, 1916, 1.904, pois este CFOP não devem ser marcado para gerar parcelas.
9-Demais CFOP devem ser marcados para gerar parcelas.
10-Clicar Gerar.
11- deixar marcado somente Notas selecionadas
12- Vencimento colocar Informar
13-Quantidade deixar 30 dias
14-Clicar em gerar
15-Msn clicar em Yes$$, NULL),

('B10', 'B', 10, 'Baixa de parcelas de fornecedores ou clientes - Entrada', $$1-Modulo escrita fiscal
2-Clicar em Movimento
3-Clicar em entradas
4-Preencher o período que deseja baixar
5-Deixar Marcado Aberta/parcial
6-Clicar em Buscar
7-Marcar Todos
8-Clicar em Pagar
9-Após conclusão clicar em Gerar

OBS: Dependo da quantidades de meses fazer de forma mensal a baixa das parcelas.$$, NULL),

('B11', 'B', 11, 'Baixa de parcelas de fornecedores ou clientes - Saída', $$1-Modulo escrita fiscal
2-Clicar em Movimento
3-Clicar em Saidas
4-Preencher o período que deseja baixar
5-Deixar Marcado Aberta/parcial
6-Clicar em Buscar
7-Marcar Todos
8-Clicar em Pagar
9-Após conclusão clicar em Gerar

OBS: Dependo da quantidades de meses fazer de forma mensal a baixa das parcelas.$$, NULL),

('B12', 'B', 12, 'Apuração fiscal', $$-Deve ser feita caso tenha verificado divergência nas informações fiscais, como estoque, fornecedores e etc.
-Esta apuração deve ser observada se houve mudança do regime tributário do cliente dentro do mes exercício, exemplo era simples nacional ate 09/2022 e alterou regime para real/presumido em 10/2022, neste caso deve ser feito 2 apuração fiscal 1 para o período do simples e outra para período do real/presumido.

1-Acessar modulo escrita Fiscal.
2-Clicar em Movimento
3-Clicar em Apuração
4-Preencher o período dos meses que deseja apurar.
5-Colocar Processar período (se não tiver nenhuma alteração de regime tributário)
6-Colocar Gerar novo período (Caso ja tenha gerado apuração no regime anterior e tenha que gerar nova apuração no mesmo ano do novo regime tributário).$$, NULL),

('B13', 'B', 13, 'Integração contábil para Inclusão dos Impostos', $$1-Clicar opção Movimento
2-Clicar em Integração contabil
3-Preencher o período que quer importar os impostos.
4-Marcar opção não gerar lançamentos contabeis ja gerados.
5-Clicar em Gerar.

OBS: Antes de Fazer esta integração o processo de executar a Apuração Fiscal ja deve ter realizado.$$, NULL),

('B14', 'B', 14, 'Pagamento de Impostos', $$1-Acessar modulo da escrita fiscal
2-Clicar em Movimento
3-Clicar em Pagamento de impostos via e-cac
4- Clicar todos os Impostos
5-Preencher o periodo de deseja fazer a consulta
6-Marcar opção com certificado por procuração
7-Clicar em consultar E-cac.

OBS: Caso o site da Receita federal esteja com instabilidade ou demorando consultar, iniciar o processo de pagamento pelo próprio sistema.

1-Clicar em movimento
2-Clicar em Pagamento de imposto
3-Clicar em Calculado pelo sistema.
4-Colocar o mes de competência
5-Marcar a opção somente em aberto
6-Clicar em Buscar
7-Selecionar impostos
8-Clicar em Pagar
9-Clicar em Novo
10-Clicar em Gerar
OBS: sempre verificar se o impostos foi pago em atraso para incluir Multa e juros no lançamento.
11-Clicar em Gravar$$, NULL),

('B15', 'B', 15, 'Regera Lançamentos Contábeis', $$1-Clicar Utilitários
2-Clicar Regerar
3-Clicar Lançamentos contabeis.
4-Preencher o periodo que Deseja regerar.
5-Marcar a opção Lançamento - Entrada e saída ou serviços.
6-Marcar a opção Baixa (pagamentos) - entrada e saída ou serviços e Impostos
7-Clicar em Regerar.
8-Clicar gravar.

OBS: Caso tenha feito alguma alteração nos acumuladores o processo de Apuração fiscal deve ser feito antes de Regerar os lançamento s contabeis.

Neste opção serve tanto para substituir ou incluir novas informações fiscais não importadas para contabilidade.$$, NULL),

('B16', 'B', 16, 'Emitir Relatório de balancete de Verificação para Conferência', $$1-Teclar F8 para escolher o cliente
2-Altera de codigo para apelido e digitar o nome do cliente
3-Clicar sobre nome da empresa e clicar Ativar
4-Clicar em relatório e clicar na opção Balancete

Premissas de analise e conferencia de dados:

1-Se for uma empresa constituída dentro do exercício (ano vigente) no mês inicial de abertura, os Saldos iniciais das contas contabeis devem estar zerados, como caixa, Fornecedor, cliente e demais, esta Conferencia deste ser validada no Cadastro da empresa no campo Inicio de Atividade.

2-Se for uma empresa constituída dentro do exercício (ano vigente) no mês inicial de abertura, deve ser feito a implantação de saldos do Capital social integralizado ou a Integralizar com validação da forma que foi constituída no contrato social.
exemplo:
Capital integralizado: D: Caixa com movimento ou banco / C: Capital social integralizado
Capital a integralizar: D: capital subscrito / C: Capital a integralizar

Desdobramento: Fez a Conferencia e validação dos Dados?
- Sim » Conclui o passo
- Não » RZ713 - CONFERENCIA E VALIDAÇÃO DA INTEGRAÇÃO CONTABIL (voltar e refazer o procedimento do Grupo A)$$, NULL),

('B17', 'B', 17, 'Verificar se existe Ativo imobilizado no balancete de Verificação para Calcular depreciação', $$1-Acessar dominio web
2-Acessar Modulo Patrimônio
3-Teclar F8 e buscar cliente
4-Clicar na opção processos
5-Clicar na opção Calcular
6-Na competência colocar o mes que deseja calcular
7-Clicar em yes para visualizar Calculo
8-Clicar novamente em Processo
9-Clicar na opção Integração contabil
10-Escolher o mes deseja importar
11-clicar em Gerar.$$, NULL),

('B18', 'B', 18, 'Relatório Balancete', $$1-Escolher data do período que será conferido no Balancete, tratando-se de empresa nova e validada no cadastro de empresa preencher data inicial da atividade.
2- A conferencia deve ser feita de Formal mensal
3-Marcar opção emitir Resumo no final$$, NULL),

('B19', 'B', 19, 'Encerramento contábil', $$1-Clicar em Utilitários
2-Clicar em Zeramento
3-Data do ultimo dia do ano que esta apurando o encerramento
OBS: simples nacional pode ser encerrado com esta data do final do ano. Real/Presumido deve ser encerrado Trimestralmente o Balanço Patrimonial. Caso tenha Mudança do Regime Tributário simples para real/presumido deve ter 2 encerramentos de zeramento contabil um para cada regime tributário.
4- Preencher no Histórico (encerramento contabil)
5-Clicar em OK
6-Clicar em ok para confirmar data de zeramento.$$, NULL),

('B20', 'B', 20, 'Emitir Relatório do Balanço patrimonial e DRE para Validação das informações', $$1-clicar Relatório
2-Balanço
3-Colocar o Período Anual ou trimestral ou mensal
4-Clicar em OK.$$, NULL)

ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS conferencia_item (
  id                    bigserial PRIMARY KEY,
  relatorio_gerado_id   bigint NOT NULL REFERENCES relatorio_gerado(id) ON DELETE CASCADE,
  passo_id              integer NOT NULL REFERENCES conferencia_passo(id),
  status                text NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente', 'ok', 'divergencia', 'nao_verificavel')),
  observacao            text,
  sugerido_automatico   boolean NOT NULL DEFAULT true,
  atualizado_por        bigint REFERENCES usuarios(id),
  atualizado_em         timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (relatorio_gerado_id, passo_id),
  CHECK (status <> 'divergencia' OR (observacao IS NOT NULL AND length(trim(observacao)) > 0))
);
CREATE INDEX IF NOT EXISTS idx_conferencia_item_relatorio ON conferencia_item(relatorio_gerado_id);
