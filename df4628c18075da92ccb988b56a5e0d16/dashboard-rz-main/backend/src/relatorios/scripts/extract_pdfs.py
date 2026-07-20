# Extrai relatórios Domínio (Balancete + Resumo por Acumulador) para SQLite.
#
# Por que não dá pra usar o texto "cru" dos PDFs:
#  - Balancete: cada linha é desenhada 2x (camada Tahoma 8.8pt decorativa na
#    margem esquerda sobreposta à camada 6.2pt real) -> texto intercalado/garbled.
#    Solução: manter só os chars ~6.2pt e reconstruir linhas por coordenada Y;
#    colunas por faixa de X; hierarquia pelo recuo (X) da descrição.
#  - Resumo: descrições longas invadem a coluna de valores (mesma fonte), mas a
#    ordem no content stream é sempre descrição->valores. Solução: ler chars em
#    ordem de stream, separar o sufixo numérico e reparti-lo em N colunas.
import pdfplumber
import re
import sqlite3
import sys
from collections import defaultdict

MONEY = re.compile(r"\d{1,3}(?:\.\d{3})*,\d{2}")


def br_to_float(s):
    return float(s.replace(".", "").replace(",", "."))


def cluster_lines(items, tol=2.5):
    """Agrupa chars/words em linhas pela coordenada 'top'."""
    lines = []
    for it in sorted(items, key=lambda c: c["top"]):
        if lines and abs(it["top"] - lines[-1][0]) <= tol:
            lines[-1][1].append(it)
        else:
            lines.append([it["top"], [it]])
    return [(top, sorted(chs, key=lambda c: c["x0"])) for top, chs in lines]


# ---------------------------------------------------------------- balancete
def parse_balancete(path):
    meta, rows = {}, []
    with pdfplumber.open(path) as pdf:
        # o PDF pode trazer vários balancetes mensais concatenados (uma seção
        # "Período: X-Y" por mês, cada uma com Balancete + Resumo do Balancete) —
        # só o último mês reflete a posição atual da empresa, os anteriores já
        # estão embutidos no saldo anterior dele. Fica só com a última seção.
        periodos = []
        for page in pdf.pages:
            txt = page.extract_text() or ""
            m = re.search(r"Período:\s*([\d/]+)\s*-\s*([\d/]+)", txt)
            periodos.append(m.groups() if m else None)
        periodo_atual = periodos[-1]
        inicio = len(periodos) - 1
        while inicio > 0 and periodos[inicio - 1] == periodo_atual:
            inicio -= 1

        txt0 = pdf.pages[inicio].extract_text() or ""
        m = re.search(r"Empresa:\s*(.+?)(?:\s+Folha:.*)?$", txt0, re.M)
        meta["empresa"] = m.group(1).strip() if m else None
        m = re.search(r"C\.N\.P\.J\.:\s*([\d./-]+)", txt0)
        meta["cnpj"] = m.group(1) if m else None
        if periodo_atual:
            meta["periodo_ini"], meta["periodo_fim"] = periodo_atual
        m = re.search(r"Emissão:\s*([\d/]+)", txt0)
        meta["emissao"] = m.group(1) if m else None

        for pno in range(inicio + 1, len(pdf.pages) + 1):
            page = pdf.pages[pno - 1]
            chars = [c for c in page.chars if abs(c["size"] - 6.2) < 0.3]
            for top, chs in cluster_lines(chars):
                # separa em palavras por gap horizontal
                words, cur = [], [chs[0]]
                for c in chs[1:]:
                    if c["x0"] - cur[-1]["x1"] > 1.5:
                        words.append(cur)
                        cur = [c]
                    else:
                        cur.append(c)
                words.append(cur)
                toks = [
                    {
                        "text": "".join(c["text"] for c in w),
                        "x0": w[0]["x0"],
                        "x1": w[-1]["x1"],
                    }
                    for w in words
                ]
                # linha de conta: começa com código numérico terminando antes de x=32
                if not (toks[0]["text"].isdigit() and toks[0]["x1"] < 32):
                    continue
                code = int(toks[0]["text"])
                desc_toks = [t for t in toks[1:] if t["x1"] < 300]
                val_toks = [t for t in toks[1:] if t["x1"] >= 300]
                if not desc_toks or len(val_toks) != 4:
                    continue
                desc = " ".join(t["text"] for t in desc_toks)
                indent = desc_toks[0]["x0"]
                level = round((indent - 35) / 6.3) + 1

                def split_dc(s):
                    dc = s[-1] if s[-1] in "DC" else None
                    return br_to_float(s.rstrip("DC")), dc

                sa, sa_dc = split_dc(val_toks[0]["text"])
                deb = br_to_float(val_toks[1]["text"])
                cred = br_to_float(val_toks[2]["text"])
                sf, sf_dc = split_dc(val_toks[3]["text"])
                rows.append(
                    dict(code=code, desc=desc, level=level, page=pno,
                         sa=sa, sa_dc=sa_dc, deb=deb, cred=cred,
                         sf=sf, sf_dc=sf_dc)
                )
    # parent via pilha de níveis
    stack = []
    for r in rows:
        while stack and stack[-1]["level"] >= r["level"]:
            stack.pop()
        r["parent"] = stack[-1]["code"] if stack else None
        stack.append(r)
    return meta, rows


# ---------------------------------------------------------------- resumo
def split_money_concat(s, n):
    """Divide 'valores colados' ('54.932,110,00...') em exatamente n tokens."""
    if n == 0:
        return [] if s == "" else None
    for m in MONEY.finditer(s):
        if m.start() != 0:
            break
        rest = split_money_concat(s[m.end():], n - 1)
        if rest is not None:
            return [m.group()] + rest
    return None


def parse_resumo(path):
    meta, sections = {}, []
    with pdfplumber.open(path) as pdf:
        page = pdf.pages[0]
        txt = page.extract_text() or ""
        m = re.search(r"CNPJ:\s*([\d./-]+)", txt)
        meta["cnpj"] = m.group(1) if m else None
        m = re.search(r"Período:\s*([\d/]+)\s*até\s*([\d/]+)", txt)
        if m:
            meta["periodo_ini"], meta["periodo_fim"] = m.groups()
        m = re.search(r"Emissão:\s*([\d/]+)", txt)
        meta["emissao"] = m.group(1) if m else None
        meta["empresa"] = (txt.splitlines() or [""])[0].split("Página")[0].strip()

        chars = [c for c in page.chars if c["size"] < 9]  # ignora título Arial
        lines = cluster_lines(chars, tol=3.0)
        section = None
        for top, chs in lines:
            flat = "".join(c["text"] for c in chs).replace(" ", "")
            # chars em ordem de stream (ordem original em page.chars)
            schars = [
                c for c in chars
                if abs(c["top"] - top) <= 3.0 and not (c["x0"] < 5 and c["text"].isdigit())
            ]  # descarta marcador '1' desenhado em x~0
            stext = "".join(c["text"] for c in schars).strip()

            if flat in ("ENTRADAS", "SAÍDAS", "SERVIÇOS"):
                section = {"nome": flat, "header_chars": None, "header": None,
                           "rows": [], "total": None}
                sections.append(section)
                continue
            if section is None or "Sistemalicenciado" in flat:
                continue
            if stext.startswith(("Código", "Cód")):
                section["header_chars"] = chs
                continue

            # linha de dados/total: sufixo numérico do stream = valores
            is_total = "Total:" in stext
            i = len(schars)
            while i > 0 and schars[i - 1]["text"] in "0123456789.,":
                i -= 1
            vchars = schars[i:]
            head = "".join(c["text"] for c in schars[:i]).replace("Total:", "").strip()
            if not vchars:
                continue
            # tokens: quebra quando o X recua ou há gap > 3
            tokens, cur = [], [vchars[0]]
            for c in vchars[1:]:
                if c["x0"] < cur[-1]["x0"] or c["x0"] - cur[-1]["x1"] > 3:
                    tokens.append(cur)
                    cur = [c]
                else:
                    cur.append(c)
            tokens.append(cur)
            vals = []
            for tk in tokens:
                s = "".join(c["text"] for c in tk)
                if not MONEY.fullmatch(s):
                    vals = None
                    break
                vals.append({"v": br_to_float(s), "x1": max(c["x1"] for c in tk)})
            if not vals:
                continue
            if is_total:
                section["total"] = vals
            else:
                m = re.match(r"^(\d+)\s*(.*)$", head)
                code = int(m.group(1)) if m else None
                desc = m.group(2).strip() if m else head
                section["rows"].append(dict(code=code, desc=desc, vals=vals))

    # nomes das colunas: alinha rótulos do cabeçalho à borda direita das colunas
    for sec in sections:
        all_rows = sec["rows"] + ([{"vals": sec["total"]}] if sec["total"] else [])
        if not all_rows:
            continue
        ncols = max(len(r["vals"]) for r in all_rows)
        edges = [
            max(r["vals"][k]["x1"] for r in all_rows if len(r["vals"]) == ncols)
            for k in range(ncols)
        ]
        names = [""] * ncols
        if sec["header_chars"]:
            # palavras do cabeçalho por gap
            words, cur = [], [sec["header_chars"][0]]
            for c in sec["header_chars"][1:]:
                if c["x0"] - cur[-1]["x1"] > 1.5:
                    words.append(cur)
                    cur = [c]
                else:
                    cur.append(c)
            words.append(cur)
            for w in words:
                wtext = "".join(c["text"] for c in w)
                if wtext in ("Código", "Cód", "Descrição"):
                    continue
                wx1 = w[-1]["x1"]
                k = min(range(ncols), key=lambda i: abs(edges[i] - wx1) if wx1 <= edges[i] + 2 else abs(edges[i] - wx1) + 1000)
                # coluna = primeira cuja borda direita >= x1 da palavra
                for i, e in enumerate(edges):
                    if wx1 <= e + 2:
                        k = i
                        break
                names[k] = (names[k] + " " + wtext).strip()
        sec["header"] = [n or f"col{i+1}" for i, n in enumerate(names)]
        sec["rows"] = [
            dict(code=r["code"], desc=r["desc"], vals=[v["v"] for v in r["vals"]])
            for r in sec["rows"]
        ]
        sec["total"] = [v["v"] for v in sec["total"]] if sec["total"] else None
        del sec["header_chars"]
    return meta, sections


# ---------------------------------------------------------------- sqlite
def build_db(db_path, bal_meta, bal_rows, res_meta, res_sections):
    con = sqlite3.connect(db_path)
    con.executescript(
        """
        DROP TABLE IF EXISTS relatorio;
        DROP TABLE IF EXISTS balancete;
        DROP TABLE IF EXISTS acumulador_secao;
        DROP TABLE IF EXISTS acumulador;
        DROP TABLE IF EXISTS acumulador_valor;

        CREATE TABLE relatorio (
            id INTEGER PRIMARY KEY,
            tipo TEXT, empresa TEXT, cnpj TEXT,
            periodo_ini TEXT, periodo_fim TEXT, emissao TEXT
        );
        CREATE TABLE balancete (
            codigo INTEGER PRIMARY KEY,
            descricao TEXT NOT NULL,
            nivel INTEGER NOT NULL,
            pai INTEGER REFERENCES balancete(codigo),
            saldo_anterior REAL, saldo_anterior_dc TEXT,
            debito REAL, credito REAL,
            saldo_atual REAL, saldo_atual_dc TEXT,
            -- assinado: D positivo, C negativo
            saldo_anterior_signed REAL, saldo_atual_signed REAL,
            pagina INTEGER
        );
        CREATE TABLE acumulador_secao (
            id INTEGER PRIMARY KEY, nome TEXT, colunas TEXT
        );
        CREATE TABLE acumulador (
            id INTEGER PRIMARY KEY,
            secao_id INTEGER REFERENCES acumulador_secao(id),
            codigo INTEGER, descricao TEXT, is_total INTEGER DEFAULT 0
        );
        CREATE TABLE acumulador_valor (
            acumulador_id INTEGER REFERENCES acumulador(id),
            coluna TEXT, valor REAL
        );
        """
    )
    con.execute(
        "INSERT INTO relatorio (tipo, empresa, cnpj, periodo_ini, periodo_fim, emissao)"
        " VALUES ('balancete', ?, ?, ?, ?, ?)",
        (bal_meta.get("empresa"), bal_meta.get("cnpj"), bal_meta.get("periodo_ini"),
         bal_meta.get("periodo_fim"), bal_meta.get("emissao")),
    )
    con.execute(
        "INSERT INTO relatorio (tipo, empresa, cnpj, periodo_ini, periodo_fim, emissao)"
        " VALUES ('resumo_acumulador', ?, ?, ?, ?, ?)",
        (res_meta.get("empresa"), res_meta.get("cnpj"), res_meta.get("periodo_ini"),
         res_meta.get("periodo_fim"), res_meta.get("emissao")),
    )
    for r in bal_rows:
        sgn = lambda v, dc: v if dc != "C" else -v
        con.execute(
            "INSERT INTO balancete VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (r["code"], r["desc"], r["level"], r["parent"],
             r["sa"], r["sa_dc"], r["deb"], r["cred"], r["sf"], r["sf_dc"],
             sgn(r["sa"], r["sa_dc"]), sgn(r["sf"], r["sf_dc"]), r["page"]),
        )
    for sec in res_sections:
        cur = con.execute(
            "INSERT INTO acumulador_secao (nome, colunas) VALUES (?, ?)",
            (sec["nome"], "|".join(sec["header"] or [])),
        )
        sid = cur.lastrowid
        for row in sec["rows"] + (
            [dict(code=None, desc="TOTAL", vals=sec["total"], total=True)]
            if sec["total"] else []
        ):
            cur = con.execute(
                "INSERT INTO acumulador (secao_id, codigo, descricao, is_total)"
                " VALUES (?,?,?,?)",
                (sid, row["code"], row["desc"], 1 if row.get("total") else 0),
            )
            aid = cur.lastrowid
            for col, val in zip(sec["header"], row["vals"]):
                con.execute(
                    "INSERT INTO acumulador_valor VALUES (?,?,?)", (aid, col, val)
                )
    con.commit()
    return con


def validate(con):
    print("\n--- VALIDAÇÃO ---")
    # 1. soma dos filhos == pai (balancete)
    bad = con.execute(
        """
        SELECT p.codigo, p.descricao, p.saldo_atual_signed,
               ROUND(SUM(f.saldo_atual_signed), 2) AS soma_filhos
        FROM balancete p JOIN balancete f ON f.pai = p.codigo
        GROUP BY p.codigo
        HAVING ABS(p.saldo_atual_signed - soma_filhos) > 0.01
        """
    ).fetchall()
    n_parents = con.execute(
        "SELECT COUNT(DISTINCT pai) FROM balancete WHERE pai IS NOT NULL"
    ).fetchone()[0]
    print(f"balancete: pais cuja soma dos filhos NÃO bate: {len(bad)} de {n_parents}")
    for b in bad:
        print("   DIVERGE:", b)
    # 2. débito/crédito global por nível 1
    for row in con.execute(
        "SELECT codigo, descricao, saldo_anterior, saldo_anterior_dc, debito,"
        " credito, saldo_atual, saldo_atual_dc FROM balancete WHERE nivel=1"
    ):
        print("nivel1:", row)
    # 3. totais do resumo vs soma das linhas
    for sid, nome in con.execute("SELECT id, nome FROM acumulador_secao"):
        q = """
            SELECT v.coluna, ROUND(SUM(v.valor),2)
            FROM acumulador a JOIN acumulador_valor v ON v.acumulador_id=a.id
            WHERE a.secao_id=? AND a.is_total=? GROUP BY v.coluna
        """
        soma = dict(con.execute(q, (sid, 0)).fetchall())
        tot = dict(con.execute(q, (sid, 1)).fetchall())
        ok = all(abs(soma.get(k, 0) - v) < 0.01 for k, v in tot.items())
        print(f"resumo[{nome}]: total bate com soma das linhas? {'SIM' if ok else 'NÃO'}")
        if not ok:
            print("   linhas:", soma)
            print("   total :", tot)


if __name__ == "__main__":
    bal_pdf, res_pdf, db_path = sys.argv[1], sys.argv[2], sys.argv[3]
    bal_meta, bal_rows = parse_balancete(bal_pdf)
    print(f"balancete: {len(bal_rows)} contas extraídas | meta={bal_meta}")
    res_meta, res_sections = parse_resumo(res_pdf)
    for s in res_sections:
        print(f"resumo[{s['nome']}]: {len(s['rows'])} linhas, colunas={s['header']},"
              f" total={s['total']}")
    con = build_db(db_path, bal_meta, bal_rows, res_meta, res_sections)
    validate(con)
    print(f"\nDB gravado em: {db_path}")
