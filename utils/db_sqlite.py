import sqlite3
from contextlib import contextmanager

import pandas as pd

from config import SQLITE_DB_PATH


@contextmanager
def sqlite_conn():
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def query_df(sql: str, params: tuple | dict | None = None) -> pd.DataFrame:
    with sqlite_conn() as conn:
        return pd.read_sql_query(sql, conn, params=params or ())


def execute(sql: str, params: tuple | dict | None = None) -> None:
    with sqlite_conn() as conn:
        conn.execute(sql, params or ())
        conn.commit()


def has_processed_data() -> bool:
    try:
        with sqlite_conn() as conn:
            count = conn.execute("SELECT COUNT(*) FROM works").fetchone()[0]
            return count > 0
    except sqlite3.Error:
        return False
