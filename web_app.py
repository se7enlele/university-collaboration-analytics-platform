import json
import sqlite3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from config import SQLITE_DB_PATH


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def has_data() -> bool:
    try:
        with db() as conn:
            return conn.execute("SELECT COUNT(*) FROM works").fetchone()[0] > 0
    except sqlite3.Error:
        return False


def rows(sql: str, params: tuple = ()) -> list[dict]:
    with db() as conn:
        return [dict(row) for row in conn.execute(sql, params).fetchall()]


def one(sql: str, params: tuple = ()) -> dict:
    result = rows(sql, params)
    return result[0] if result else {}


def overview() -> dict:
    if not has_data():
        return {
            "ready": False,
            "papers": 0,
            "international_papers": 0,
            "countries": 0,
            "institutions": 0,
            "lead_rate": 0,
        }
    data = one(
        """
        SELECT
            COUNT(DISTINCT w.id) AS papers,
            COUNT(DISTINCT CASE WHEN w.is_international = 1 THEN w.id END) AS international_papers,
            COUNT(DISTINCT c.collab_country) AS countries,
            COUNT(DISTINCT c.collab_institution) AS institutions,
            ROUND(
                100.0 * COUNT(DISTINCT CASE WHEN w.is_international = 1 AND w.is_lead = 1 THEN w.id END)
                / NULLIF(COUNT(DISTINCT CASE WHEN w.is_international = 1 THEN w.id END), 0),
                1
            ) AS lead_rate
        FROM works w
        LEFT JOIN collaborations c ON w.id = c.work_id
        """
    )
    data["ready"] = True
    return data


def country_map() -> list[dict]:
    if not has_data():
        return []
    return rows(
        """
        SELECT
            c.collab_country AS code,
            c.collab_country_name AS name,
            COUNT(DISTINCT w.id) AS papers,
            COUNT(DISTINCT c.collab_institution) AS institutions
        FROM works w
        JOIN collaborations c ON w.id = c.work_id
        WHERE c.collab_country != ''
        GROUP BY c.collab_country, c.collab_country_name
        ORDER BY papers DESC
        """
    )


def institution_rank(limit: int = 20) -> list[dict]:
    if not has_data():
        return []
    return rows(
        """
        SELECT
            c.collab_institution AS institution,
            c.collab_country_name AS country,
            COUNT(DISTINCT w.id) AS papers,
            ROUND(AVG(w.cited_by), 1) AS avg_cited,
            MAX(w.year) AS last_year
        FROM works w
        JOIN collaborations c ON w.id = c.work_id
        WHERE w.is_international = 1
        GROUP BY c.collab_institution, c.collab_country_name
        ORDER BY papers DESC
        LIMIT ?
        """,
        (limit,),
    )


def subjects(limit: int = 20) -> list[dict]:
    if not has_data():
        return []
    return rows(
        """
        SELECT
            COALESCE(NULLIF(domain, ''), '未分类') AS domain,
            COUNT(*) AS papers,
            ROUND(AVG(cited_by), 1) AS avg_cited
        FROM works
        WHERE is_international = 1
        GROUP BY COALESCE(NULLIF(domain, ''), '未分类')
        ORDER BY papers DESC
        LIMIT ?
        """,
        (limit,),
    )


def benchmark() -> list[dict]:
    if not has_data():
        return []
    return rows(
        """
        SELECT
            w.university AS university,
            COUNT(DISTINCT w.id) AS papers,
            COUNT(DISTINCT CASE WHEN w.is_international = 1 THEN w.id END) AS international_papers,
            COUNT(DISTINCT c.collab_country) AS countries,
            COUNT(DISTINCT c.collab_institution) AS institutions,
            ROUND(
                100.0 * COUNT(DISTINCT CASE WHEN w.is_international = 1 AND w.is_lead = 1 THEN w.id END)
                / NULLIF(COUNT(DISTINCT CASE WHEN w.is_international = 1 THEN w.id END), 0),
                1
            ) AS lead_rate
        FROM works w
        LEFT JOIN collaborations c ON w.id = c.work_id
        GROUP BY w.university
        ORDER BY university
        """
    )


API = {
    "/api/overview": overview,
    "/api/map": country_map,
    "/api/institutions": institution_rank,
    "/api/subjects": subjects,
    "/api/benchmark": benchmark,
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path in API:
            query = parse_qs(parsed.query)
            limit = int(query.get("limit", ["20"])[0])
            handler = API[parsed.path]
            payload = handler(limit) if parsed.path in {"/api/institutions", "/api/subjects"} else handler()
            self.send_json(payload)
            return

        if parsed.path in {"/", "/map", "/institutions", "/subjects", "/benchmark", "/admin", "/login"}:
            self.path = "/index.html"
        super().do_GET()

    def send_json(self, payload) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", 8000), Handler)
    print("Web app running at http://127.0.0.1:8000")
    server.serve_forever()


if __name__ == "__main__":
    main()
