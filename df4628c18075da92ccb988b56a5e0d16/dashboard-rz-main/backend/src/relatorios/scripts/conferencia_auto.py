# Pre-preenchimento automatico de itens do checklist de conferencia, a partir
# do relatorio.db ja extraido (mesmo arquivo que gen_xlsx.py/gen_html.py leem).
# So cobre os passos do procedimento interno que dao pra calcular com o que
# temos hoje (Balancete + Resumo por Acumulador) - os demais (a maioria)
# ficam nao_verificavel, decidido no lado Node (relatorios.service.ts), que
# so aplica aqui o que este script efetivamente conseguiu calcular.
#
# E so SUGESTAO: o contador revisa e pode sobrescrever qualquer item na tela.
# Nunca falha "duro" - se uma regra nao consegue resolver a conta (empresa sem
# aquele plano de contas), ela emite nao_verificavel para AQUELA regra em vez
# de derrubar o script inteiro.
import sys
import json
import sqlite3
from plano_contas import PlanoContas, resolve_conta

TOLERANCIA_PCT = 0.15  # 15% - comparacoes aqui sao aproximadas (nao filtram por CFOP)


def fmt(v):
    return f"R$ {abs(v):,.2f}".replace(",", "#").replace(".", ",").replace("#", ".")


def total_secao(con, nome):
    row = con.execute(
        """SELECT v.valor FROM acumulador a
           JOIN acumulador_secao s ON s.id = a.secao_id
           JOIN acumulador_valor v ON v.acumulador_id = a.id AND v.coluna = 'Vlr Contábil'
           WHERE a.is_total = 1 AND s.nome = ?""",
        (nome,),
    ).fetchone()
    return row[0] if row else None


def existe_conta_valor(con, padrao, nivel=None):
    """Resolve conta por nome (LIKE); retorna (codigo, saldo_atual_signed) ou (None, 0)."""
    codigo = resolve_conta(con, padrao, nivel=nivel, obrigatorio=False)
    if codigo is None:
        return None, 0.0
    row = con.execute("SELECT saldo_atual_signed FROM balancete WHERE codigo = ?", (codigo,)).fetchone()
    return codigo, (row[0] if row else 0.0)


def regra_importado(con, codigo_passo, padrao, grupo_esperado, nivel=None):
    """Checagem generica de 'foi importado no Ativo/Passivo/Resultado com saldo != 0'."""
    codigo, saldo = existe_conta_valor(con, padrao, nivel=nivel)
    if codigo is None:
        return dict(
            codigo=codigo_passo, status="divergencia",
            observacao=f"Conta \"{padrao}\" não localizada no plano de contas extraído do balancete.",
        )
    if abs(saldo) < 0.01:
        return dict(
            codigo=codigo_passo, status="divergencia",
            observacao=f"Conta \"{padrao}\" (código {codigo}) localizada, mas com saldo zerado no período.",
        )
    return dict(
        codigo=codigo_passo, status="ok",
        observacao=(
            f"Conta \"{padrao}\" (código {codigo}) importada com saldo de {fmt(saldo)}. "
            f"Comparação com o resumo da folha de pagamento não realizada — este relatório "
            f"não recebe esse documento como entrada."
        ),
    )


def regra_saldo_negativo_grupo(pc):
    grupos = [
        (pc.ATIVO, "D", "Ativo"),
        (pc.PASSIVO, "C", "Passivo"),
        (pc.RESULT_CUSTOS, "D", "Resultado (Despesas/Custos/Deduções)"),
        (pc.RESULT_RECEITAS, "C", "Resultado (Receitas)"),
    ]
    problemas = []
    for codigo, esperado, nome in grupos:
        if codigo is None:
            continue
        saldo = pc.conta(codigo)["saldo_atual_signed"]
        invertido = (esperado == "D" and saldo < -0.01) or (esperado == "C" and saldo > 0.01)
        if invertido:
            problemas.append(f"{nome} com saldo {'credor' if esperado == 'D' else 'devedor'} de {fmt(saldo)} (esperado {esperado})")
    if problemas:
        return dict(codigo="A03", status="divergencia", observacao="; ".join(problemas) + ".")
    return dict(codigo="A03", status="ok", observacao="Saldos de nível 1 (Ativo/Passivo/Resultado) com sinal D/C esperado.")


def regra_caixa_credor(pc):
    disp = pc.conta(pc.DISPONIVEL)
    if pc.DISPONIVEL and disp["saldo_atual_signed"] < -0.01:
        return dict(
            codigo="A04", status="divergencia",
            observacao=f"Caixa/disponível com saldo credor de {fmt(disp['saldo_atual_signed'])}.",
        )
    return dict(codigo="A04", status="ok", observacao="Sem saldo credor de caixa detectado no balancete.")


def regra_comparacao_secao(con, codigo_passo, saldo_conta, nome_conta, nomes_secao):
    total = None
    secao_usada = None
    for nome in nomes_secao:
        total = total_secao(con, nome)
        if total is not None:
            secao_usada = nome
            break
    if total is None:
        return dict(
            codigo=codigo_passo, status="nao_verificavel",
            observacao=f"Seção {'/'.join(nomes_secao)} não presente no resumo por acumulador extraído — comparação não aplicável.",
        )
    saldo_abs = abs(saldo_conta)
    diff = abs(saldo_abs - total)
    tolerancia = max(total, saldo_abs) * TOLERANCIA_PCT
    if diff > tolerancia:
        return dict(
            codigo=codigo_passo, status="divergencia",
            observacao=(
                f"{nome_conta} no balancete ({fmt(saldo_abs)}) diverge do total da seção {secao_usada} "
                f"do resumo por acumulador ({fmt(total)}) além da tolerância de {int(TOLERANCIA_PCT*100)}% "
                f"(comparação por total da seção, sem filtro de CFOP)."
            ),
        )
    return dict(
        codigo=codigo_passo, status="ok",
        observacao=(
            f"{nome_conta} ({fmt(saldo_abs)}) compatível com o total da seção {secao_usada} "
            f"({fmt(total)}) dentro da tolerância de {int(TOLERANCIA_PCT*100)}%."
        ),
    )


def regra_estrutura_balanco(con):
    bad = con.execute(
        """
        SELECT COUNT(*) FROM (
          SELECT p.codigo
          FROM balancete p JOIN balancete f ON f.pai = p.codigo
          GROUP BY p.codigo
          HAVING ABS(p.saldo_atual_signed - ROUND(SUM(f.saldo_atual_signed), 2)) > 0.01
        )
        """
    ).fetchone()[0]
    if bad > 0:
        return dict(
            codigo="A22", status="divergencia",
            observacao=f"{bad} conta(s) sintética(s) cuja soma dos filhos não bate com o saldo da conta pai — plano de contas fora da estrutura padrão.",
        )
    return dict(codigo="A22", status="ok", observacao="Soma dos filhos bate com a conta pai em todo o plano de contas extraído.")


def main():
    db_path = sys.argv[1]
    con = sqlite3.connect(db_path)
    pc = PlanoContas(con)
    saidas = []

    saidas.append(regra_saldo_negativo_grupo(pc))
    saidas.append(regra_caixa_credor(pc))
    saidas.append(regra_importado(con, "A06", "%SIMPLES NACIONAL%", "Passivo"))
    saidas.append(regra_importado(con, "A10", "%CLIENTES%", "Ativo"))
    saidas.append(regra_importado(con, "A11", "%SAL%RIOS%ORDENADOS%", "Resultado"))
    saidas.append(regra_importado(con, "A12", "%FGTS%", "Passivo"))
    saidas.append(regra_importado(con, "A13", "%INSS%", "Passivo"))
    saidas.append(regra_importado(con, "A14", "%IRRF%", "Passivo"))
    saidas.append(regra_importado(con, "A15", "%PR%-LABORE%", "Passivo"))
    saidas.append(regra_importado(con, "A16", "%PROVIS%F%RIAS%", "Passivo"))
    saidas.append(regra_importado(con, "A17", "%CAPITAL SOCIAL%", "Passivo"))
    # A17 tem regra propria (capital_social_existe) - reaproveita a mesma checagem "importado"

    forn = pc.conta(pc.FORNECEDORES_NAC)
    saidas.append(regra_comparacao_secao(con, "A07", forn["saldo_atual_signed"], "Fornecedores", ["ENTRADAS"]))

    estoque = pc.conta(pc.ESTOQUE)
    saidas.append(regra_comparacao_secao(con, "A08", estoque["saldo_atual_signed"], "Estoque/Mercadorias", ["ENTRADAS"]))

    receita = pc.conta(pc.RECEITA_BRUTA)
    resultado_receita = regra_comparacao_secao(con, "A09", receita["saldo_atual_signed"], "Receita Bruta", ["SERVIÇOS", "SAÍDAS"])
    saidas.append(resultado_receita)
    # A23 pergunta a mesma coisa que A09 no texto do procedimento - aplica o mesmo veredito
    saidas.append(dict(codigo="A23", status=resultado_receita["status"], observacao=resultado_receita["observacao"]))

    saidas.append(regra_estrutura_balanco(con))

    print(json.dumps(saidas, ensure_ascii=False))


if __name__ == "__main__":
    main()
