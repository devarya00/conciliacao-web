# Resolução do plano de contas a partir de relatorio.db — compartilhado entre
# gen_xlsx.py e gen_html.py, pra garantir que os dois geradores calculem os
# mesmos números a partir da mesma lógica.
#
# Universal entre empresas: resolve pelo NOME (plano de contas referencial
# padrão do Domínio: "ATIVO CIRCULANTE", "RECEITA BRUTA DE VENDAS E SERVIÇOS"
# etc.), não pelo código numérico — o código varia de empresa pra empresa, o
# nome não. Contas de ramo específico (ex.: Veículos) são opcionais.
import sys


def resolve_conta(con, padrao, nivel=None, obrigatorio=True):
    q = "SELECT codigo FROM balancete WHERE descricao LIKE ?"
    params = [padrao]
    if nivel is not None:
        q += " AND nivel = ?"
        params.append(nivel)
    q += " ORDER BY codigo LIMIT 1"
    row = con.execute(q, params).fetchone()
    if row is None:
        if obrigatorio:
            sys.exit(
                f"conta '{padrao}'" + (f" (nível {nivel})" if nivel else "")
                + " não encontrada no plano de contas desta empresa — o relatório"
                  " pressupõe o plano de contas referencial padrão do Domínio"
            )
        return None
    return row[0]


class PlanoContas:
    """Códigos das contas estruturais desta empresa, resolvidos por nome, e os
    valores agregados (saldo anterior/atual assinados, débito, crédito) já
    prontos pra uso — mesmas contas que o gen_xlsx.py monta em fórmula."""

    def __init__(self, con):
        self.con = con
        r = lambda padrao, nivel=None, obrigatorio=True: resolve_conta(con, padrao, nivel, obrigatorio)

        self.ATIVO = r("ATIVO", nivel=1)
        self.PASSIVO = r("PASSIVO", nivel=1)

        self.ATIVO_CIRC = r("ATIVO CIRCULANTE", nivel=2, obrigatorio=False)
        self.DISPONIVEL = r("DISPON%", nivel=3, obrigatorio=False)
        self.OUTROS_CRED = r("OUTROS CR%", nivel=3, obrigatorio=False)
        self.ESTOQUE = r("ESTOQUE%", nivel=3, obrigatorio=False)
        self.ATIVO_NAO_CIRC = r("ATIVO N%CIRCULANTE", nivel=2, obrigatorio=False)
        self.PASSIVO_CIRC = r("PASSIVO CIRCULANTE", nivel=2, obrigatorio=False)
        self.PASSIVO_NAO_CIRC = r("PASSIVO N%CIRCULANTE", nivel=2, obrigatorio=False)
        self.PL = r("PATRIM%NIO L%QUIDO", nivel=2, obrigatorio=False)
        self.FORNECEDORES = r("FORNECEDORES", nivel=3, obrigatorio=False)
        self.OBRIG_TRIB = r("OBRIGA%TRIBUT%", nivel=3, obrigatorio=False)
        self.OBRIG_TRAB = r("OBRIGA%TRABALHIST%", nivel=3, obrigatorio=False)
        self.CAPITAL_SOCIAL = r("CAPITAL SOCIAL%", nivel=3, obrigatorio=False)
        self.LUCROS_PREJ = r("LUCROS%PREJU%", nivel=3, obrigatorio=False)
        self.RESULT_CUSTOS = r("CONTAS DE RESULTADO%CUSTOS%", nivel=1, obrigatorio=False)
        self.RESULT_RECEITAS = r("CONTAS DE RESULTADO%RECEITA%", nivel=1, obrigatorio=False)
        self.RECEITA_BRUTA = r("RECEITA BRUTA%", nivel=3, obrigatorio=False)
        self.DEDUCOES_RECEITA = r("%DEDU%RECEITA%", nivel=3, obrigatorio=False)
        self.CUSTOS = r("CUSTOS", nivel=2, obrigatorio=False)
        # CMV especificamente (subconjunto de CUSTOS) — usado só na conferência
        # custo×estoque, onde precisão importa: CUSTOS pode incluir despesa que
        # não passa por estoque (ex.: ICMS antecipação ST)
        self.CMV = r("CUSTO%MERCADORIA%VEND%", obrigatorio=False)
        self.DESP_VENDAS = r("DESPESAS COM VENDAS%", nivel=3, obrigatorio=False)
        self.DESP_ADMIN = r("DESPESAS ADMINISTRATIVAS%", nivel=3, obrigatorio=False)

        self.VEICULOS = r("VE%CULOS%", obrigatorio=False)
        self.DEPRECIACOES = r("%DEPRECIA%", obrigatorio=False)
        self.FORNECEDORES_NAC = r("FORNECEDORES NACIONAIS%", obrigatorio=False) or self.FORNECEDORES

    def conta(self, codigo):
        """Linha completa (dict) da conta, ou zeros se código for None (conta
        opcional que essa empresa/período não tem)."""
        if codigo is None:
            return dict(saldo_anterior_signed=0.0, saldo_atual_signed=0.0, debito=0.0, credito=0.0)
        row = self.con.execute(
            "SELECT saldo_anterior_signed, saldo_atual_signed, debito, credito"
            " FROM balancete WHERE codigo = ?",
            (codigo,),
        ).fetchone()
        if row is None:
            return dict(saldo_anterior_signed=0.0, saldo_atual_signed=0.0, debito=0.0, credito=0.0)
        return dict(zip(("saldo_anterior_signed", "saldo_atual_signed", "debito", "credito"), row))

    def fornecedores(self):
        """Lista de fornecedores (código, descrição, saldo anterior/atual
        assinados, débito, crédito) filhos da conta sintética, ordenados pelo
        saldo atual desc — mesma query do gen_xlsx.py."""
        rows = self.con.execute(
            "SELECT codigo, descricao, saldo_anterior_signed, saldo_atual_signed,"
            " debito, credito FROM balancete WHERE pai = ? ORDER BY saldo_atual DESC",
            (self.FORNECEDORES_NAC,),
        ).fetchall()
        return [
            dict(codigo=cod, descricao=desc, saldo_anterior=-sa, saldo_atual=-sf, compras=cred, pagamentos=deb)
            for cod, desc, sa, sf, deb, cred in rows
        ]
