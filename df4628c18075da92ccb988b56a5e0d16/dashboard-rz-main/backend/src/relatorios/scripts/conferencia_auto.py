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
    """Checagem generica de 'foi importado no Ativo/Passivo/Resultado com saldo != 0'.
    Sem contrapartida fiscal (folha de pagamento nao e' documento de entrada deste
    relatorio) - valorFiscal fica None, exibido como "-" na tabela de comparacao."""
    codigo, saldo = existe_conta_valor(con, padrao, nivel=nivel)
    if codigo is None:
        return dict(
            codigo=codigo_passo, status="divergencia",
            observacao=f"Conta \"{padrao}\" não localizada no plano de contas extraído do balancete.",
            valorFiscal=None, valorContabil=None,
        )
    if abs(saldo) < 0.01:
        return dict(
            codigo=codigo_passo, status="divergencia",
            observacao=f"Conta \"{padrao}\" (código {codigo}) localizada, mas com saldo zerado no período.",
            valorFiscal=None, valorContabil=abs(saldo),
        )
    return dict(
        codigo=codigo_passo, status="ok",
        observacao=f"Conta \"{padrao}\" (código {codigo}) importada.",
        valorFiscal=None, valorContabil=abs(saldo),
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
    saldo = disp["saldo_atual_signed"] if pc.DISPONIVEL else None
    if pc.DISPONIVEL and saldo < -0.01:
        return dict(
            codigo="A04", status="divergencia", observacao="Caixa/disponível com saldo credor.",
            valorFiscal=None, valorContabil=abs(saldo),
        )
    return dict(
        codigo="A04", status="ok", observacao="Sem saldo credor de caixa detectado no balancete.",
        valorFiscal=None, valorContabil=(abs(saldo) if saldo is not None else None),
    )


def regra_comparacao_secao(con, codigo_passo, codigo_conta, saldo_conta, nome_conta, nomes_secao):
    """Compara um saldo do balancete contra o total de uma secao do resumo por
    acumulador. Alem do status/observacao (curtos, pra tabela), devolve
    valorFiscal/valorContabil pra exibicao em colunas separadas."""
    conta_txt = f"{nome_conta} (conta {codigo_conta})" if codigo_conta else nome_conta
    total = None
    for nome in nomes_secao:
        total = total_secao(con, nome)
        if total is not None:
            break
    if total is None:
        return dict(
            codigo=codigo_passo, status="nao_verificavel",
            observacao=f"{conta_txt}: seção {'/'.join(nomes_secao)} não presente no resumo.",
            valorFiscal=None, valorContabil=None,
        )
    saldo_abs = abs(saldo_conta)
    diff = abs(saldo_abs - total)
    tolerancia = max(total, saldo_abs) * TOLERANCIA_PCT
    status = "divergencia" if diff > tolerancia else "ok"
    observacao = f"{conta_txt}: divergência de valor." if status == "divergencia" else f"{conta_txt} confere."
    return dict(codigo=codigo_passo, status=status, observacao=observacao, valorFiscal=total, valorContabil=saldo_abs)


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
    saidas.append(regra_comparacao_secao(con, "A07", pc.FORNECEDORES_NAC, forn["saldo_atual_signed"], "Fornecedores", ["ENTRADAS"]))

    estoque = pc.conta(pc.ESTOQUE)
    saidas.append(regra_comparacao_secao(con, "A08", pc.ESTOQUE, estoque["saldo_atual_signed"], "Estoque/Mercadorias", ["ENTRADAS"]))

    receita = pc.conta(pc.RECEITA_BRUTA)
    resultado_receita = regra_comparacao_secao(con, "A09", pc.RECEITA_BRUTA, receita["saldo_atual_signed"], "Receita Bruta", ["SERVIÇOS", "SAÍDAS"])
    saidas.append(resultado_receita)
    # A23 pergunta a mesma coisa que A09 no texto do procedimento - aplica o mesmo veredito
    saidas.append(dict(
        codigo="A23", status=resultado_receita["status"], observacao=resultado_receita["observacao"],
        valorFiscal=resultado_receita.get("valorFiscal"), valorContabil=resultado_receita.get("valorContabil"),
    ))

    saidas.append(regra_estrutura_balanco(con))

    print(json.dumps(saidas, ensure_ascii=False))


if __name__ == "__main__":
    main()
