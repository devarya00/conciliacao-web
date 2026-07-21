# Gera relatorio-gerencial.html a partir de relatorio.db — versão detalhada
# do relatório gerencial (KPIs, DRE, balanço, fornecedores, movimento fiscal
# e apontamentos automáticos de gestão), pra impressão em PDF via Chromium
# headless (ver relatorios.service.ts).
#
# Mesma filosofia do gen_xlsx.py: contas resolvidas por NOME via plano_contas
# (universal entre empresas), campos opcionais somem do relatório em vez de
# quebrar a geração. Os apontamentos (callouts) também são regras genéricas
# sobre os dados extraídos — nenhum texto é específico de uma empresa.
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from plano_contas import PlanoContas
import sqlite3

DB = sys.argv[1] if len(sys.argv) > 1 else "relatorio.db"
OUT = sys.argv[2] if len(sys.argv) > 2 else "relatorio-gerencial.html"

TEMPLATES_DIR = Path(__file__).parent / "templates"

# limiares das regras de apontamento — nada específico de empresa, só o ponto
# de corte a partir do qual vale chamar atenção
LIMIAR_CONCENTRACAO_CREDOR = 0.25  # 25% do saldo de fornecedores num único credor
LIMIAR_MARGEM_CUSTO = 1.0  # custo >= 100% da receita líquida do período
PALAVRAS_CADASTRO_GENERICO = ("MODELO", "PADRAO", "PADRÃO", "GENERIC", "TESTE", "IMPLANTACAO", "IMPLANTAÇÃO")
SUFIXOS_EMPRESA = (" LTDA", " ME", " EPP", " EIRELI", " EIRELLI", " SA", " S/A", " S.A.")


def fmt_brl(v):
    neg = v < 0
    s = f"{abs(v):,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"({s})" if neg else s


def fmt_pct(v):
    s = f"{abs(v) * 100:.1f}".replace(".", ",")
    return f"−{s}%" if v < 0 else f"{s}%"


def normaliza_nome(nome):
    n = nome.upper().strip()
    for suf in SUFIXOS_EMPRESA:
        if n.endswith(suf):
            n = n[: -len(suf)].strip()
    return n


CONECTORES_PT = {"de", "da", "do", "das", "dos", "e"}


def titulo_pt(nome):
    """Capitaliza nome próprio pra exibição (fonte vem em CAIXA ALTA do
    Domínio); mantém conectores em minúsculo."""
    palavras = nome.strip().split(" ")
    out = [
        p.lower() if i > 0 and p.lower() in CONECTORES_PT else p.capitalize()
        for i, p in enumerate(palavras)
    ]
    return " ".join(out)


CHAR_PX = 4.7  # largura média de um caractere no rótulo de valor (8.6px tabular)


def trunca(s, n=28):
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def escala_barras(itens, largura_max_px=158, altura_barra=11.5, gap=7.5, viewbox_w=340, offset_x=142):
    """itens: lista de (rótulo, valor, cor). Devolve lista de dicts prontos
    pra desenhar <rect>/<text> — largura proporcional ao maior valor, rótulo
    dentro da barra se couber, fora (à direita) senão. label_x/pct_x sempre
    ancorados na borda direita real da barra, não no rótulo anterior."""
    maximo = max((v for _, v, _ in itens), default=0) or 1
    barras = []
    y = 4
    for rotulo, valor, cor in itens:
        largura = max((valor / maximo) * largura_max_px, 1.5)
        rx = min(3, largura / 2)
        borda = offset_x + largura
        valor_fmt = fmt_brl(valor)
        dentro = largura > len(valor_fmt) * CHAR_PX + 8
        if dentro:
            label_x, pct_x = borda - 4, borda + 5
        else:
            label_x = borda + 5
            pct_x = label_x + len(valor_fmt) * CHAR_PX + 6
        barras.append(dict(
            rotulo=trunca(rotulo),
            valor_fmt=valor_fmt,
            x=offset_x,
            y=y,
            largura=round(largura, 1),
            altura=altura_barra,
            rx=round(rx, 1),
            cor=cor,
            label_x=round(label_x, 1),
            pct_x=round(pct_x, 1),
            label_anchor="end" if dentro else "start",
            label_fill="#ffffff" if dentro else None,
            cat_y=y + altura_barra / 2 + 3.5,
        ))
        y += altura_barra + gap
    altura_total = y - gap + 4
    return barras, altura_total


def apontamentos(pc, con, ctx):
    """Regras genéricas de apontamento — cada uma só aparece se a condição
    disparar. Empresa saudável pode terminar sem nenhum apontamento crítico."""
    pontos = []

    # 1) caixa (disponível) com saldo credor
    disp = pc.conta(pc.DISPONIVEL)
    if pc.DISPONIVEL and disp["saldo_atual_signed"] < -0.01:
        atual = disp["saldo_atual_signed"]
        anterior = disp["saldo_anterior_signed"]
        if anterior < 0:
            corpo = (
                f"Caixa não pode encerrar credor. O saldo já abria negativo em {ctx['periodo_ini']} "
                f"(R$ {fmt_brl(-anterior)} C) e {'foi reduzido' if atual > anterior else 'aumentou'} "
                f"no período. Indica despesas pagas sem origem de recursos registrada — verificar "
                f"suprimentos de caixa, aportes do titular ou receitas não contabilizadas."
            )
        else:
            corpo = (
                f"Caixa virou credor neste período (era R$ {fmt_brl(anterior)} positivo em "
                f"{ctx['periodo_ini']}, foi para R$ {fmt_brl(-atual)} credor). Indica despesas pagas "
                f"sem origem de recursos registrada — verificar suprimentos de caixa, aportes do "
                f"titular ou receitas não contabilizadas."
            )
        pontos.append(dict(
            nivel="crit", tag="Inconsistência contábil",
            titulo=f"Caixa com saldo credor de R$ {fmt_brl(-atual)}", corpo=corpo,
        ))

    # 2) passivo a descoberto (PL efetivo negativo)
    if ctx["pl_efetivo"] < -0.01:
        partes = []
        if ctx["prejuizos_acumulados"] < 0:
            partes.append(f"prejuízos acumulados (R$ {fmt_brl(-ctx['prejuizos_acumulados'])})")
        if ctx["resultado_nao_encerrado"] < 0:
            partes.append(f"resultado não encerrado (R$ {fmt_brl(-ctx['resultado_nao_encerrado'])})")
        comp = " somados ao ".join(partes) if partes else "os prejuízos acumulados"
        comp = comp[0].upper() + comp[1:]
        corpo = f"{comp} superam o capital social de R$ {fmt_brl(ctx['capital_social'])}."
        if ctx["ativo_circulante"] > 0:
            razao = ctx["passivo_circulante"] / ctx["ativo_circulante"]
            razao_fmt = f"{razao:.1f}".replace(".", ",")
            corpo += (
                f" O passivo circulante (R$ {fmt_brl(ctx['passivo_circulante'])}) é {razao_fmt} vezes "
                f"o ativo circulante (R$ {fmt_brl(ctx['ativo_circulante'])})."
            )
        pontos.append(dict(
            nivel="crit", tag="Situação patrimonial",
            titulo=f"Passivo a descoberto de R$ {fmt_brl(-ctx['pl_efetivo'])}", corpo=corpo,
        ))

    # 3) concentração de credor (+ detecção de cadastro duplicado por nome)
    forn = ctx["fornecedores_todos"]
    total_forn = sum(f["saldo_atual"] for f in forn)
    if forn and total_forn > 0:
        maior = forn[0]
        pct = maior["saldo_atual"] / total_forn
        # duplicidade: mesmo nome normalizado em mais de uma conta
        grupos = {}
        for f in forn:
            grupos.setdefault(normaliza_nome(f["descricao"]), []).append(f)
        duplicados = [g for g in grupos.values() if len(g) > 1]
        if duplicados:
            grupo = max(duplicados, key=lambda g: sum(x["saldo_atual"] for x in g))
            soma_grupo = sum(x["saldo_atual"] for x in grupo)
            pct_grupo = soma_grupo / total_forn
            if pct_grupo >= LIMIAR_CONCENTRACAO_CREDOR:
                nomes = ", ".join(f'"{titulo_pt(x["descricao"])}"' for x in grupo)
                codigos = ", ".join(str(x["codigo"]) for x in grupo)
                pontos.append(dict(
                    nivel="warn", tag="Concentração de credor",
                    titulo=f"{fmt_pct(pct_grupo)} da dívida com um único credor (possível cadastro duplicado)",
                    corpo=(
                        f"{nomes} aparece em {len(grupo)} contas (códigos {codigos}) somando "
                        f"R$ {fmt_brl(soma_grupo)}. Recomenda-se unificar o cadastro e formalizar a "
                        f"dívida, se aplicável."
                    ),
                ))
        elif pct >= LIMIAR_CONCENTRACAO_CREDOR:
            pontos.append(dict(
                nivel="warn", tag="Concentração de credor",
                titulo=f"{fmt_pct(pct)} da dívida com um único credor",
                corpo=(
                    f'"{titulo_pt(maior["descricao"])}" (código {maior["codigo"]}) concentra sozinho '
                    f"R$ {fmt_brl(maior['saldo_atual'])} do saldo de fornecedores."
                ),
            ))

    # 4) higiene cadastral — nomes de implantação/placeholder com saldo real
    for f in forn:
        nome_upper = f["descricao"].upper()
        if abs(f["saldo_atual"]) > 0.01 and any(p in nome_upper for p in PALAVRAS_CADASTRO_GENERICO):
            pontos.append(dict(
                nivel="warn", tag="Higiene cadastral",
                titulo=f'Conta "{titulo_pt(f["descricao"])}" com saldo de R$ {fmt_brl(f["saldo_atual"])}',
                corpo="Cadastro genérico de implantação carregando saldo real — identificar o credor efetivo e reclassificar.",
            ))

    # 5) margem operacional — custo isolado consumindo >= 100% da receita líquida
    for lbl, bim, acu in ctx["custos_para_margem"]:
        if ctx["receita_liquida_bim"] > 0 and bim >= ctx["receita_liquida_bim"] * LIMIAR_MARGEM_CUSTO:
            pct = bim / ctx["receita_liquida_bim"]
            corpo = (
                f"No período, o custo com {lbl.lower()} (R$ {fmt_brl(bim)}) superou a receita líquida "
                f"(R$ {fmt_brl(ctx['receita_liquida_bim'])})."
            )
            if ctx["receita_liquida_acu"] > 0:
                corpo += (
                    f" No acumulado o quadro é parecido: R$ {fmt_brl(acu)} de custo para "
                    f"R$ {fmt_brl(ctx['receita_liquida_acu'])} de receita."
                )
            pontos.append(dict(
                nivel="plain", tag="Margem operacional",
                titulo=f"{lbl} consome {fmt_pct(pct)} da receita líquida", corpo=corpo,
            ))

    return pontos


def main():
    con = sqlite3.connect(DB)
    emp, cnpj, p0, p1, emis = con.execute(
        "SELECT empresa, cnpj, periodo_ini, periodo_fim, emissao FROM relatorio WHERE tipo='balancete'"
    ).fetchone()
    pc = PlanoContas(con)

    def val(codigo, campo="saldo_atual_signed"):
        return pc.conta(codigo)[campo]

    # DRE — movimento do período (débito/crédito) e saldo acumulado do exercício
    receita_bruta_bim = val(pc.RECEITA_BRUTA, "credito") - val(pc.RECEITA_BRUTA, "debito")
    receita_bruta_acu = -val(pc.RECEITA_BRUTA)
    deducoes_bim = -(val(pc.DEDUCOES_RECEITA, "debito") - val(pc.DEDUCOES_RECEITA, "credito"))
    deducoes_acu = -val(pc.DEDUCOES_RECEITA)
    receita_liq_bim = receita_bruta_bim + deducoes_bim
    receita_liq_acu = receita_bruta_acu + deducoes_acu
    custos_bim = -(val(pc.CUSTOS, "debito") - val(pc.CUSTOS, "credito"))
    custos_acu = -val(pc.CUSTOS)
    resultado_bruto_bim = receita_liq_bim + custos_bim
    resultado_bruto_acu = receita_liq_acu + custos_acu
    desp_vendas_bim = -(val(pc.DESP_VENDAS, "debito") - val(pc.DESP_VENDAS, "credito"))
    desp_vendas_acu = -val(pc.DESP_VENDAS)
    desp_admin_bim = -(val(pc.DESP_ADMIN, "debito") - val(pc.DESP_ADMIN, "credito"))
    desp_admin_acu = -val(pc.DESP_ADMIN)
    resultado_bim = resultado_bruto_bim + desp_vendas_bim + desp_admin_bim
    resultado_acu = resultado_bruto_acu + desp_vendas_acu + desp_admin_acu

    # % receita líq.: linhas individuais mostram magnitude (quanto aquele item
    # representa da receita); subtotais/total mostram o percentual assinado
    # (reflete o resultado acumulado até ali, pode ser negativo)
    def pct_item(v):
        return abs(v / receita_liq_bim) if receita_liq_bim else 0.0

    def pct_total(v):
        return v / receita_liq_bim if receita_liq_bim else 0.0

    dre_rows = [r for r in [
        dict(lbl="Receita de prestação de serviços", valor=receita_bruta_bim, pct=pct_item(receita_bruta_bim), kind=""),
        dict(lbl="(−) Deduções sobre a receita", valor=deducoes_bim, pct=pct_item(deducoes_bim), kind="sub") if pc.DEDUCOES_RECEITA else None,
        dict(lbl="Receita líquida", valor=receita_liq_bim, pct=pct_total(receita_liq_bim), kind="group"),
        dict(lbl="(−) Custos", valor=custos_bim, pct=pct_item(custos_bim), kind="") if pc.CUSTOS else None,
        dict(lbl="Resultado bruto", valor=resultado_bruto_bim, pct=pct_total(resultado_bruto_bim), kind="group"),
        dict(lbl="(−) Despesas com vendas", valor=desp_vendas_bim, pct=pct_item(desp_vendas_bim), kind="") if pc.DESP_VENDAS else None,
        dict(lbl="(−) Despesas administrativas", valor=desp_admin_bim, pct=pct_item(desp_admin_bim), kind="") if pc.DESP_ADMIN else None,
        dict(lbl="Resultado do período", valor=resultado_bim, pct=pct_total(resultado_bim), kind="total"),
    ] if r]

    acumulado_rows = [r for r in [
        dict(lbl="Receitas líquidas acumuladas", valor=receita_liq_acu, kind=""),
        dict(lbl="(−) Custos acumulados", valor=custos_acu, kind="") if pc.CUSTOS else None,
        dict(lbl="(−) Despesas com vendas", valor=desp_vendas_acu, kind="") if pc.DESP_VENDAS else None,
        dict(lbl="(−) Despesas administrativas", valor=desp_admin_acu, kind="") if pc.DESP_ADMIN else None,
        dict(lbl="Resultado acumulado", valor=resultado_acu, kind="total"),
    ] if r]

    # Balanço
    ativo_circ = val(pc.ATIVO_CIRC)
    disponivel = val(pc.DISPONIVEL)
    outros_cred = val(pc.OUTROS_CRED)
    estoque = val(pc.ESTOQUE)
    ativo_nao_circ = val(pc.ATIVO_NAO_CIRC)
    veiculos = val(pc.VEICULOS)
    depreciacoes = val(pc.DEPRECIACOES)
    total_ativo = ativo_circ + ativo_nao_circ

    passivo_circ = -val(pc.PASSIVO_CIRC)
    fornecedores_saldo = -val(pc.FORNECEDORES)
    obrig_trib = -val(pc.OBRIG_TRIB)
    obrig_trab = -val(pc.OBRIG_TRAB)
    passivo_nao_circ = -val(pc.PASSIVO_NAO_CIRC)
    resultado_nao_encerrado = -(val(pc.RESULT_CUSTOS) + val(pc.RESULT_RECEITAS))
    pl_efetivo = -val(pc.PL) - (val(pc.RESULT_CUSTOS) + val(pc.RESULT_RECEITAS))
    capital_social = -val(pc.CAPITAL_SOCIAL)
    prejuizos_acumulados = -val(pc.LUCROS_PREJ)
    total_passivo_pl = passivo_circ + passivo_nao_circ + pl_efetivo

    ativo_rows = [r for r in [
        dict(lbl="Ativo circulante", valor=ativo_circ, kind="group"),
        dict(lbl="Disponível — caixa geral", valor=disponivel, kind="sub", flag="credor" if disponivel < 0 else None) if pc.DISPONIVEL else None,
        dict(lbl="Outros créditos", valor=outros_cred, kind="sub") if pc.OUTROS_CRED else None,
        dict(lbl="Estoque — mercadorias e insumos", valor=estoque, kind="sub") if pc.ESTOQUE else None,
        dict(lbl="Ativo não circulante", valor=ativo_nao_circ, kind="group"),
        dict(lbl="Veículos", valor=veiculos, kind="sub") if pc.VEICULOS else None,
        dict(lbl="(−) Depreciações acumuladas", valor=depreciacoes, kind="sub") if pc.DEPRECIACOES else None,
        dict(lbl="Total do ativo", valor=total_ativo, kind="total"),
    ] if r]

    passivo_rows = [r for r in [
        dict(lbl="Passivo circulante", valor=passivo_circ, kind="group"),
        dict(lbl="Fornecedores", valor=fornecedores_saldo, kind="sub") if pc.FORNECEDORES else None,
        dict(lbl="Obrigações tributárias", valor=obrig_trib, kind="sub") if pc.OBRIG_TRIB else None,
        dict(lbl="Obrigações trabalhistas e previd.", valor=obrig_trab, kind="sub") if pc.OBRIG_TRAB else None,
        dict(lbl="Passivo não circulante", valor=passivo_nao_circ, kind="group") if pc.PASSIVO_NAO_CIRC else None,
        dict(lbl="Patrimônio líquido efetivo", valor=pl_efetivo, kind="group"),
        dict(lbl="Capital social subscrito", valor=capital_social, kind="sub") if pc.CAPITAL_SOCIAL else None,
        dict(lbl="(−) Prejuízos acumulados", valor=prejuizos_acumulados, kind="sub") if pc.LUCROS_PREJ else None,
        dict(lbl="(−) Resultado não encerrado", valor=resultado_nao_encerrado, kind="sub"),
        dict(lbl="Total passivo + PL", valor=total_passivo_pl, kind="total"),
    ] if r]

    # Fornecedores — top 10 + gráfico de barras
    fornecedores_todos = pc.fornecedores()
    total_forn = sum(f["saldo_atual"] for f in fornecedores_todos)
    top10 = fornecedores_todos[:10]
    demais = fornecedores_todos[10:]
    demais_soma = sum(f["saldo_atual"] for f in demais)
    compras_bim = sum(f["compras"] for f in fornecedores_todos)
    pagamentos_bim = sum(f["pagamentos"] for f in fornecedores_todos)
    barras_forn, altura_forn = escala_barras(
        [(titulo_pt(f["descricao"]), f["saldo_atual"], "#2a78d6") for f in top10 if f["saldo_atual"] > 0]
    )
    for b, f in zip(barras_forn, top10):
        b["pct"] = fmt_pct(f["saldo_atual"] / total_forn) if total_forn else "0,0%"

    # Receita x desembolsos (gráfico de barras da página 1) — receita líquida +
    # até 3 maiores categorias de desembolso do período
    desembolsos = [r for r in [
        ("Custos", custos_bim) if pc.CUSTOS else None,
        ("Despesas com vendas", desp_vendas_bim) if pc.DESP_VENDAS else None,
        ("Despesas administrativas", desp_admin_bim) if pc.DESP_ADMIN else None,
    ] if r and r[1] < 0]
    desembolsos = [(lbl, abs(v)) for lbl, v in desembolsos]
    desembolsos.sort(key=lambda x: -x[1])
    itens_receita = [("Receita líquida", receita_liq_bim, "#2a78d6")] + [
        (lbl, v, "#e34948") for lbl, v in desembolsos[:3]
    ]
    barras_receita, altura_receita = escala_barras(itens_receita, largura_max_px=130, offset_x=119)

    # Movimento fiscal (resumo por acumulador) — direto das seções extraídas
    fiscal_secoes = []
    for sid, nome in con.execute("SELECT id, nome FROM acumulador_secao ORDER BY id"):
        linhas = con.execute(
            """SELECT a.codigo, a.descricao, v.valor FROM acumulador a
               JOIN acumulador_valor v ON v.acumulador_id = a.id
               WHERE a.secao_id=? AND a.is_total=0 AND v.coluna='Vlr Contábil'
               ORDER BY a.id""",
            (sid,),
        ).fetchall()
        total = con.execute(
            """SELECT v.valor FROM acumulador a JOIN acumulador_valor v ON v.acumulador_id=a.id
               WHERE a.secao_id=? AND a.is_total=1 AND v.coluna='Vlr Contábil'""",
            (sid,),
        ).fetchone()
        fiscal_secoes.append(dict(
            nome=nome.capitalize(),
            linhas=[dict(codigo=c, descricao=d, valor=v) for c, d, v in linhas],
            total=total[0] if total else sum(v for _, _, v in linhas),
        ))

    extra_cols_soma = con.execute(
        "SELECT COALESCE(SUM(ABS(v.valor)),0) FROM acumulador a JOIN acumulador_valor v"
        " ON v.acumulador_id=a.id WHERE a.is_total=0 AND v.coluna <> 'Vlr Contábil'"
    ).fetchone()[0]
    fiscal_nota = (
        "Não há bases nem créditos de ICMS, IPI ou ISS destacados nos acumuladores deste "
        "período — compatível com o regime do Simples Nacional."
        if extra_cols_soma < 0.01 and fiscal_secoes else ""
    )

    ctx = dict(
        empresa=emp, cnpj=cnpj, periodo_ini=p0, periodo_fim=p1, emissao=emis,
        receita_liquida_bim=receita_liq_bim, receita_liquida_acu=receita_liq_acu,
        receita_bruta_bim=receita_bruta_bim,
        resultado_bim=resultado_bim, resultado_acu=resultado_acu,
        fornecedores_total=total_forn, fornecedores_qtd=len(fornecedores_todos),
        pl_efetivo=pl_efetivo, ativo_circulante=ativo_circ, passivo_circulante=passivo_circ,
        capital_social=capital_social, prejuizos_acumulados=prejuizos_acumulados,
        resultado_nao_encerrado=resultado_nao_encerrado,
        fornecedores_todos=fornecedores_todos,
        custos_para_margem=[
            (lbl, bim, acu) for lbl, bim, acu in [
                ("Custos", custos_bim, custos_acu),
                ("Despesas com vendas", desp_vendas_bim, desp_vendas_acu),
                ("Despesas administrativas", desp_admin_bim, desp_admin_acu),
            ] if bim > 0
        ],
    )
    callouts = apontamentos(pc, con, ctx)

    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True)
    env.filters["brl"] = fmt_brl
    env.filters["pct"] = fmt_pct
    tpl = env.get_template("relatorio.html.jinja")

    html = tpl.render(
        empresa=titulo_pt(emp), cnpj=cnpj, periodo_ini=p0, periodo_fim=p1, emissao=emis,
        kpis=[
            dict(lbl="Receita bruta do período", valor=receita_bruta_bim,
                 nota="100% prestação de serviços" if pc.RECEITA_BRUTA else "", neg=False),
            dict(lbl="Resultado do período", valor=resultado_bim,
                 nota="prejuízo no período" if resultado_bim < 0 else "resultado positivo no período",
                 neg=resultado_bim < 0),
            dict(lbl="Fornecedores a pagar", valor=total_forn,
                 nota=f"{len(fornecedores_todos)} credores · em {p1}", neg=False),
            dict(lbl="Patrimônio líquido efetivo", valor=pl_efetivo,
                 nota="com resultado não encerrado", neg=pl_efetivo < 0),
        ],
        dre_rows=dre_rows, acumulado_rows=acumulado_rows,
        barras_receita=barras_receita, altura_receita=altura_receita,
        desembolsos_cap=(
            f"Azul: entrada · vermelho: saídas."
            + (f" {desembolsos[0][0]} é o maior desembolso do período"
               f" (R$ {fmt_brl(desembolsos[0][1])})." if desembolsos else "")
        ),
        ativo_rows=ativo_rows, passivo_rows=passivo_rows,
        fornecedores_nota=(
            f"Saldo total de R$ {fmt_brl(total_forn)} distribuído entre {len(fornecedores_todos)} "
            f"credores em {p1}. Movimento do período: R$ {fmt_brl(compras_bim)} em novas compras, "
            f"R$ {fmt_brl(pagamentos_bim)} em pagamentos."
        ),
        barras_fornecedores=barras_forn, altura_fornecedores=altura_forn,
        fornecedores_cap=(
            f"Demais {len(demais)} fornecedores somam R$ {fmt_brl(demais_soma)} "
            f"({fmt_pct(demais_soma / total_forn) if total_forn else '0,0%'})."
            if demais else ""
        ),
        fiscal_secoes=fiscal_secoes,
        fiscal_nota=fiscal_nota,
        callouts=callouts,
    )
    Path(OUT).write_text(html, encoding="utf-8")
    print(f"gravado: {OUT}")


if __name__ == "__main__":
    main()
