import sqlite3
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path(__file__).parent / "data" / "Uniform.db"

class Database:
    def __init__(self, path=DB_PATH):
        self.path = path

    @contextmanager
    def connect(self): 
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def execute_query(self, query: str, params: dict = None):
        with self.connect() as conn:
            cur = conn.cursor()
            cur.execute(query, params or {})
            rows = cur.fetchall()
            return [dict(row) for row in rows]

db = Database()
