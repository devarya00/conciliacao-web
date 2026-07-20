#!/usr/bin/env python3
"""Ingest the S3D "gestao de entregas" CSV export into a SQLite database.

Usage:
    python3 ingest.py --csv /path/to/export.csv [--db gestao_entregas.db]

The CSV is ';'-delimited, UTF-8 with BOM, dates as DD/MM/YYYY, columns:
Obrigação / Tarefa; Tipo; Empresa; EmpID; CNPJ; Cidade; Estado; Prazo legal;
Prazo Técnico; Data da entrega; Status; Departamento; Responsável prazo;
Responsável entrega; Competência; Protocolo
"""
import argparse
import csv
import sqlite3
from pathlib import Path

SCHEMA_PATH = Path(__file__).parent / "schema.sql"
MERGES_PATH = Path(__file__).parent / "merges.sql"
ACTIVE_FLAGS_PATH = Path(__file__).parent / "active_flags.sql"
QUALITY_FLAGS_PATH = Path(__file__).parent / "quality_flags.sql"

COL = {
    "obrigacao_tarefa": 0,
    "tipo": 1,
    "empresa_nome": 2,
    "emp_id": 3,
    "cnpj": 4,
    "cidade": 5,
    "estado": 6,
    "prazo_legal": 7,
    "prazo_tecnico": 8,
    "data_entrega": 9,
    "status": 10,
    "departamento": 11,
    "responsavel_prazo": 12,
    "responsavel_entrega": 13,
    "competencia": 14,
    "protocolo": 15,
}


def to_iso_date(value: str) -> str | None:
    value = value.strip()
    if not value:
        return None
    day, month, year = value.split("/")
    return f"{year}-{month}-{day}"


def split_competencia(value: str) -> tuple[int, int]:
    month, year = value.strip().split("/")
    return int(year), int(month)


def load_rows(csv_path: Path) -> list[list[str]]:
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f, delimiter=";")
        header = next(reader)
        expected = len(COL)
        if len(header) != expected:
            raise ValueError(f"expected {expected} columns, CSV header has {len(header)}: {header}")
        return list(reader)


def ingest(csv_path: Path, db_path: Path) -> None:
    rows = load_rows(csv_path)

    con = sqlite3.connect(db_path)
    con.executescript(SCHEMA_PATH.read_text())

    empresa_cache: dict[str, None] = {}
    responsavel_cache: dict[str, int] = {}

    def responsavel_id(nome_raw: str) -> int | None:
        nome_raw = nome_raw.strip()
        if not nome_raw:
            return None
        if nome_raw not in responsavel_cache:
            cur = con.execute(
                "INSERT INTO responsaveis (nome_raw) VALUES (?)", (nome_raw,)
            )
            responsavel_cache[nome_raw] = cur.lastrowid
        return responsavel_cache[nome_raw]

    obrigacoes_batch = []
    for row in rows:
        emp_id = int(row[COL["emp_id"]])
        if emp_id not in empresa_cache:
            con.execute(
                "INSERT OR IGNORE INTO empresas (emp_id, cnpj, nome, cidade, estado) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    emp_id,
                    row[COL["cnpj"]],
                    row[COL["empresa_nome"]],
                    row[COL["cidade"]] or None,
                    row[COL["estado"]] or None,
                ),
            )
            empresa_cache[emp_id] = None

        ano, mes = split_competencia(row[COL["competencia"]])

        obrigacoes_batch.append(
            (
                row[COL["obrigacao_tarefa"]],
                row[COL["tipo"]],
                emp_id,
                to_iso_date(row[COL["prazo_legal"]]),
                to_iso_date(row[COL["prazo_tecnico"]]),
                to_iso_date(row[COL["data_entrega"]]),
                row[COL["status"]],
                row[COL["departamento"]] or None,
                responsavel_id(row[COL["responsavel_prazo"]]),
                responsavel_id(row[COL["responsavel_entrega"]]),
                ano,
                mes,
                row[COL["protocolo"]] or None,
            )
        )

    con.executemany(
        """
        INSERT INTO obrigacoes (
            obrigacao_tarefa, tipo, emp_id, prazo_legal, prazo_tecnico,
            data_entrega, status, departamento,
            responsavel_prazo_id, responsavel_entrega_id,
            competencia_ano, competencia_mes, protocolo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        obrigacoes_batch,
    )
    con.commit()

    if MERGES_PATH.exists():
        con.executescript(MERGES_PATH.read_text())
        con.commit()

    if ACTIVE_FLAGS_PATH.exists():
        con.executescript(ACTIVE_FLAGS_PATH.read_text())
        con.commit()

    if QUALITY_FLAGS_PATH.exists():
        con.executescript(QUALITY_FLAGS_PATH.read_text())
        con.commit()

    n_empresas = con.execute("SELECT COUNT(*) FROM empresas").fetchone()[0]
    n_resp = con.execute("SELECT COUNT(*) FROM responsaveis").fetchone()[0]
    n_obr = con.execute("SELECT COUNT(*) FROM obrigacoes").fetchone()[0]
    con.close()

    print(f"ingested {n_obr} obrigacoes, {n_empresas} empresas, {n_resp} responsaveis -> {db_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", required=True, type=Path)
    parser.add_argument(
        "--db",
        type=Path,
        default=Path(__file__).parent / "gestao_entregas.db",
    )
    args = parser.parse_args()
    ingest(args.csv, args.db)


if __name__ == "__main__":
    main()
