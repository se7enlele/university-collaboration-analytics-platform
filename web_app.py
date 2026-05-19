import json
import os
import sqlite3
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from config import SQLITE_DB_PATH


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"

PLATFORM_TOTALS = {
    "papers": 320_000_000,
    "international_papers": 68_000_000,
    "countries": 230,
    "institutions": 120_000,
    "universities": 3_000,
}


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


def universities() -> list[dict]:
    if not has_data():
        return []
    return rows(
        """
        SELECT
            university,
            COUNT(DISTINCT id) AS papers,
            COUNT(DISTINCT CASE WHEN is_international = 1 THEN id END) AS international_papers
        FROM works
        WHERE university IS NOT NULL AND university != ''
        GROUP BY university
        ORDER BY international_papers DESC, papers DESC
        """
    )


def overview(university: str | None = None) -> dict:
    if not has_data():
        return {"ready": False, **PLATFORM_TOTALS, "lead_rate": 0}

    work_where = "WHERE university = ?" if university else ""
    collab_where = "WHERE university = ?" if university else ""
    params = (university,) if university else ()
    work_sample = one(
        f"""
        SELECT
            COUNT(*) AS sample_papers,
            COUNT(CASE WHEN is_international = 1 THEN 1 END) AS sample_international_papers,
            ROUND(
                100.0 * COUNT(CASE WHEN is_international = 1 AND is_lead = 1 THEN 1 END)
                / NULLIF(COUNT(CASE WHEN is_international = 1 THEN 1 END), 0),
                1
            ) AS lead_rate
        FROM works
        {work_where}
        """,
        params,
    )
    collab_sample = one(
        f"""
        SELECT
            COUNT(DISTINCT collab_country) AS sample_countries,
            COUNT(DISTINCT collab_institution) AS sample_institutions
        FROM collaborations
        {collab_where}
        """,
        params,
    )
    return {"ready": True, **PLATFORM_TOTALS, "selected_university": university, **work_sample, **collab_sample}


def country_map(university: str | None = None) -> list[dict]:
    if not has_data():
        return []
    params = (university,) if university else ()
    university_filter = "AND university = ?" if university else ""
    return rows(
        f"""
        SELECT
            collab_country AS code,
            collab_country_name AS name,
            COUNT(DISTINCT work_id) AS papers,
            COUNT(DISTINCT collab_institution) AS institutions
        FROM collaborations
        WHERE collab_country != ''
        {university_filter}
        GROUP BY collab_country, collab_country_name
        ORDER BY papers DESC
        """,
        params,
    )


def region_name(country: str) -> str:
    europe = {"United Kingdom", "Germany", "France", "Italy", "Spain", "Sweden", "Netherlands", "Switzerland", "Russian Federation", "Portugal", "Poland", "Greece", "Belgium", "Denmark", "Finland", "Norway", "Austria", "Ireland", "Czechia", "Hungary"}
    asia = {"Japan", "Singapore", "Hong Kong", "South Korea", "India", "Malaysia", "Thailand", "Pakistan", "Saudi Arabia", "United Arab Emirates", "Israel", "Turkey", "Iran", "Indonesia"}
    north_america = {"United States", "Canada", "Mexico"}
    oceania = {"Australia", "New Zealand"}
    if country in europe:
        return "欧洲"
    if country in asia:
        return "亚洲"
    if country in north_america:
        return "北美"
    if country in oceania:
        return "大洋洲"
    return "其他地区"


def institution_rank(limit: int = 20, university: str | None = None) -> list[dict]:
    if not has_data():
        return []
    params = (university, limit) if university else (limit,)
    university_filter = "AND c.university = ?" if university else ""
    return rows(
        f"""
        SELECT
            c.collab_institution AS institution,
            c.collab_country_name AS country,
            COUNT(DISTINCT w.id) AS papers,
            COUNT(DISTINCT CASE WHEN w.is_lead = 1 THEN w.id END) AS lead_papers,
            ROUND(
                100.0 * COUNT(DISTINCT CASE WHEN w.is_lead = 1 THEN w.id END)
                / NULLIF(COUNT(DISTINCT w.id), 0),
                1
            ) AS lead_rate,
            ROUND(AVG(w.cited_by), 1) AS avg_cited,
            MAX(w.year) AS last_year,
            CAST(? - MAX(w.year) AS INTEGER) AS silent_years
        FROM works w
        JOIN collaborations c ON w.id = c.work_id
        WHERE w.is_international = 1
        {university_filter}
        GROUP BY c.collab_institution, c.collab_country_name
        ORDER BY papers DESC
        LIMIT ?
        """,
        (datetime.now().year, *params),
    )


def collaboration_analysis(university: str | None = None) -> dict:
    if not has_data():
        return {"countries": [], "regions": [], "institutions": [], "trend": [], "insights": []}

    countries_all = country_map(university)
    countries = countries_all[:20]
    institutions = institution_rank(10, university)
    params = (university, datetime.now().year) if university else (datetime.now().year,)
    university_filter = "AND university = ?" if university else ""
    trend = rows(
        f"""
        SELECT
            year,
            COUNT(*) AS papers,
            0 AS countries,
            0 AS institutions
        FROM works
        WHERE is_international = 1
        {university_filter}
        AND year IS NOT NULL AND year < ?
        GROUP BY year
        ORDER BY year DESC
        LIMIT 8
        """,
        params,
    )
    trend = list(reversed(trend))

    region_totals: dict[str, dict] = {}
    for item in countries_all:
        region = region_name(item.get("name") or "")
        current = region_totals.setdefault(region, {"region": region, "papers": 0, "countries": 0, "institutions": 0})
        current["papers"] += item.get("papers") or 0
        current["countries"] += 1
        current["institutions"] += item.get("institutions") or 0
    regions = sorted(region_totals.values(), key=lambda item: item["papers"], reverse=True)

    top_country = countries[0] if countries else {}
    top_region = regions[0] if regions else {}
    top_institution = institutions[0] if institutions else {}
    latest = trend[-1] if trend else {}
    earliest = trend[0] if trend else {}
    growth = 0
    if earliest.get("papers"):
        growth = round((latest.get("papers", 0) - earliest["papers"]) / earliest["papers"] * 100, 1)

    insights = [
        {
            "title": "合作重心清晰",
            "text": f"{top_country.get('name', '重点国家')} 是当前样例库中最核心的合作国家，贡献 {top_country.get('papers', 0):,} 篇合作论文。",
        },
        {
            "title": "区域集聚明显",
            "text": f"{top_region.get('region', '重点区域')} 是合作最集中的区域，覆盖 {top_region.get('countries', 0)} 个国家/地区。",
        },
        {
            "title": "核心机构可优先维护",
            "text": f"{top_institution.get('institution', '高频合作机构')} 是高频合作伙伴，可作为稳定合作关系维护对象。",
        },
        {
            "title": "趋势变化可追踪",
            "text": f"样例库近年合作论文变化约为 {growth}%，适合继续结合学院和学科维度判断增长来源。",
        },
    ]
    return {"countries": countries, "regions": regions, "institutions": institutions, "trend": trend, "insights": insights}


def subjects(limit: int = 20, university: str | None = None) -> list[dict]:
    if not has_data():
        return []
    params = (university, limit) if university else (limit,)
    university_filter = "AND university = ?" if university else ""
    return rows(
        f"""
        SELECT
            COALESCE(NULLIF(domain, ''), '未分类') AS domain,
            COUNT(*) AS papers,
            ROUND(AVG(cited_by), 1) AS avg_cited
        FROM works
        WHERE is_international = 1
        {university_filter}
        GROUP BY COALESCE(NULLIF(domain, ''), '未分类')
        ORDER BY papers DESC
        LIMIT ?
        """,
        params,
    )


def sample_works(limit: int = 10, university: str | None = None) -> list[dict]:
    if not has_data():
        return []
    params = (university, limit) if university else (limit,)
    university_filter = "AND university = ?" if university else ""
    return rows(
        f"""
        SELECT
            title,
            year,
            COALESCE(NULLIF(journal, ''), '-') AS journal,
            COALESCE(NULLIF(type, ''), '-') AS type,
            COALESCE(NULLIF(domain, ''), '未分类') AS domain,
            cited_by
        FROM works
        WHERE is_international = 1
        {university_filter}
        ORDER BY year DESC, cited_by DESC
        LIMIT ?
        """,
        params,
    )


def benchmark() -> list[dict]:
    if not has_data():
        return []
    return rows(
        """
        WITH sample AS (
            SELECT *
            FROM (
                SELECT
                    w.*,
                    ROW_NUMBER() OVER (PARTITION BY w.university ORDER BY w.year DESC, w.id DESC) AS rn
                FROM works w
            )
            WHERE rn <= 1200
        )
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
        FROM sample w
        LEFT JOIN collaborations c ON w.id = c.work_id
        GROUP BY w.university
        ORDER BY university
        """
    )


def zombie_partners(university: str | None = None) -> dict:
    if not has_data():
        return {"summary": {}, "partners": []}
    params = (university,) if university else ()
    university_filter = "AND c.university = ?" if university else ""
    partners = rows(
        f"""
        SELECT
            c.collab_institution AS institution,
            c.collab_country_name AS country,
            COUNT(DISTINCT w.id) AS papers,
            MAX(w.year) AS last_year,
            CAST(? - MAX(w.year) AS INTEGER) AS silent_years
        FROM works w
        JOIN collaborations c ON w.id = c.work_id
        WHERE w.is_international = 1 AND c.collab_institution != ''
        {university_filter}
        GROUP BY c.collab_institution, c.collab_country_name
        HAVING papers >= 2
        ORDER BY papers DESC, silent_years DESC
        """,
        (datetime.now().year, *params),
    )
    for item in partners:
        silent = item.get("silent_years") or 0
        if silent >= 3:
            item["status"] = "僵尸"
            item["priority"] = "需要复盘"
        elif silent >= 1:
            item["status"] = "警告"
            item["priority"] = "建议跟进"
        else:
            item["status"] = "活跃"
            item["priority"] = "持续维护"
    summary = {
        "total": len(partners),
        "active": sum(1 for item in partners if item["status"] == "活跃"),
        "warning": sum(1 for item in partners if item["status"] == "警告"),
        "zombie": sum(1 for item in partners if item["status"] == "僵尸"),
    }
    zombies = sorted(
        [item for item in partners if item["status"] == "僵尸"],
        key=lambda item: (item.get("papers") or 0, item.get("silent_years") or 0),
        reverse=True,
    )[:80]
    warnings = sorted(
        [item for item in partners if item["status"] == "警告"],
        key=lambda item: (item.get("papers") or 0, item.get("silent_years") or 0),
        reverse=True,
    )[:40]
    active = sorted(
        [item for item in partners if item["status"] == "活跃"],
        key=lambda item: item.get("papers") or 0,
        reverse=True,
    )[:20]
    return {"summary": summary, "partners": [*zombies, *warnings, *active]}


def performance_dashboard(university: str | None = None) -> dict:
    if not has_data():
        return {"metrics": {}, "trend": [], "benchmarks": []}
    params = (university,) if university else ()
    work_where = "WHERE university = ?" if university else ""
    metrics = one(
        f"""
        SELECT
            COUNT(*) AS papers,
            COUNT(CASE WHEN is_international = 1 THEN 1 END) AS international_papers,
            ROUND(100.0 * COUNT(CASE WHEN is_international = 1 THEN 1 END) / NULLIF(COUNT(*), 0), 1) AS international_share,
            COUNT(CASE WHEN is_international = 1 AND cited_by = 0 THEN 1 END) AS zero_cited,
            ROUND(100.0 * COUNT(CASE WHEN is_international = 1 AND cited_by = 0 THEN 1 END) / NULLIF(COUNT(CASE WHEN is_international = 1 THEN 1 END), 0), 1) AS zero_cited_rate,
            COUNT(CASE WHEN is_international = 1 AND is_lead = 1 THEN 1 END) AS lead_papers,
            ROUND(100.0 * COUNT(CASE WHEN is_international = 1 AND is_lead = 1 THEN 1 END) / NULLIF(COUNT(CASE WHEN is_international = 1 THEN 1 END), 0), 1) AS lead_rate
        FROM works
        {work_where}
        """,
        params,
    )
    trend_params = (university, datetime.now().year) if university else (datetime.now().year,)
    trend_filter = "AND university = ?" if university else ""
    trend = rows(
        f"""
        SELECT
            year,
            COUNT(CASE WHEN is_international = 1 THEN 1 END) AS international_papers
        FROM works
        WHERE year IS NOT NULL
        {trend_filter}
        AND year < ?
        GROUP BY year
        ORDER BY year DESC
        LIMIT 5
        """,
        trend_params,
    )
    trend = list(reversed(trend))
    growth = 0
    if len(trend) >= 2 and trend[0].get("international_papers"):
        growth = round((trend[-1]["international_papers"] - trend[0]["international_papers"]) / trend[0]["international_papers"] * 100, 1)
    metrics["growth_rate"] = growth
    metrics["selected_university"] = university
    return {"metrics": metrics, "trend": trend, "benchmarks": benchmark()}


API = {
    "/api/universities": universities,
    "/api/overview": overview,
    "/api/map": country_map,
    "/api/collaboration": collaboration_analysis,
    "/api/institutions": institution_rank,
    "/api/subjects": subjects,
    "/api/works": sample_works,
    "/api/benchmark": benchmark,
    "/api/zombies": zombie_partners,
    "/api/performance": performance_dashboard,
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path in API:
            query = parse_qs(parsed.query)
            limit = int(query.get("limit", ["20"])[0])
            university = query.get("university", [None])[0]
            handler = API[parsed.path]
            if parsed.path in {"/api/institutions", "/api/subjects", "/api/works"}:
                payload = handler(limit, university)
            elif parsed.path in {"/api/overview", "/api/map", "/api/collaboration", "/api/zombies", "/api/performance"}:
                payload = handler(university)
            else:
                payload = handler()
            self.send_json(payload)
            return

        if parsed.path in {"/", "/map", "/institutions", "/subjects", "/benchmark", "/zombies", "/dashboard", "/performance", "/admin", "/login"}:
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
    port = int(os.getenv("WEB_PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Web app running at http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
