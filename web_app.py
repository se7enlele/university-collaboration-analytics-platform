import json
import os
import sqlite3
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from config import SQLITE_DB_PATH
from config import ADMIN_PASSWORD
from utils.business_db import (
    approve_access_request,
    create_access_request,
    create_session,
    get_or_create_user,
    list_access_requests,
    list_users,
    reject_access_request,
    revoke_session,
    update_access_request_lead,
    user_by_session,
)
from utils.business_notify import notify_access_request
from utils.business_sms import send_login_sms_code, verify_login_sms_code
from utils.data_pipeline import data_status, refresh_university, resolve_source_metadata, seed_university_sources


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


def collaborator_finder(limit: int = 12, university: str | None = None, keyword: str | None = None) -> dict:
    if not has_data():
        return {"items": [], "keyword": keyword or "", "summary": {}}

    keyword = (keyword or "").strip()
    params: list[object] = []
    where = ["w.is_international = 1", "c.collab_institution != ''"]
    if university:
        where.append("w.university = ?")
        params.append(university)
    if keyword:
        like = f"%{keyword}%"
        where.append("(w.topic LIKE ? OR w.domain LIKE ? OR w.title LIKE ?)")
        params.extend([like, like, like])

    where_sql = " AND ".join(where)
    base_stats = rows(
        f"""
        SELECT
            COUNT(DISTINCT w.id) AS matched_works,
            COUNT(DISTINCT c.collab_institution) AS matched_institutions,
            COUNT(DISTINCT COALESCE(NULLIF(c.collab_country_name, ''), c.collab_country)) AS matched_countries,
            MIN(w.year) AS start_year,
            MAX(w.year) AS end_year
        FROM works w
        JOIN collaborations c ON w.id = c.work_id
        WHERE {where_sql}
        """,
        tuple(params),
    )[0]
    items = rows(
        f"""
        WITH candidate AS (
            SELECT
                c.collab_institution AS institution,
                COALESCE(NULLIF(c.collab_country_name, ''), '-') AS country,
                COUNT(DISTINCT w.id) AS papers,
                COUNT(DISTINCT CASE WHEN w.is_lead = 1 THEN w.id END) AS lead_papers,
                ROUND(AVG(w.cited_by), 1) AS avg_cited,
                MAX(w.year) AS last_year,
                MAX(w.title) AS representative_title,
                MAX(COALESCE(NULLIF(w.topic, ''), COALESCE(NULLIF(w.domain, ''), '未分类'))) AS topic
            FROM works w
            JOIN collaborations c ON w.id = c.work_id
            WHERE {where_sql}
            GROUP BY c.collab_institution, c.collab_country_name
        )
        SELECT
            institution,
            country,
            papers,
            lead_papers,
            ROUND(100.0 * lead_papers / NULLIF(papers, 0), 1) AS lead_rate,
            avg_cited,
            last_year,
            representative_title,
            topic,
            ROUND((papers * 1.0) + (avg_cited * 0.08) + (CASE WHEN last_year >= ? THEN 8 ELSE 0 END), 1) AS score
        FROM candidate
        ORDER BY score DESC, papers DESC
        LIMIT ?
        """,
        (*params, datetime.now().year - 2, limit),
    )
    is_fallback = False
    if not items and keyword:
        fallback_params: list[object] = []
        fallback_where = ["w.is_international = 1", "c.collab_institution != ''"]
        if university:
            fallback_where.append("w.university = ?")
            fallback_params.append(university)
        fallback_sql = " AND ".join(fallback_where)
        items = rows(
            f"""
            WITH candidate AS (
                SELECT
                    c.collab_institution AS institution,
                    COALESCE(NULLIF(c.collab_country_name, ''), '-') AS country,
                    COUNT(DISTINCT w.id) AS papers,
                    COUNT(DISTINCT CASE WHEN w.is_lead = 1 THEN w.id END) AS lead_papers,
                    ROUND(AVG(w.cited_by), 1) AS avg_cited,
                    MAX(w.year) AS last_year,
                    MAX(w.title) AS representative_title,
                    MAX(COALESCE(NULLIF(w.topic, ''), COALESCE(NULLIF(w.domain, ''), 'Unclassified'))) AS topic
                FROM works w
                JOIN collaborations c ON w.id = c.work_id
                WHERE {fallback_sql}
                GROUP BY c.collab_institution, c.collab_country_name
            )
            SELECT
                institution,
                country,
                papers,
                lead_papers,
                ROUND(100.0 * lead_papers / NULLIF(papers, 0), 1) AS lead_rate,
                avg_cited,
                last_year,
                representative_title,
                topic,
                ROUND((papers * 1.0) + (avg_cited * 0.08) + (CASE WHEN last_year >= ? THEN 8 ELSE 0 END), 1) AS score
            FROM candidate
            ORDER BY score DESC, papers DESC
            LIMIT ?
            """,
            (*fallback_params, datetime.now().year - 2, limit),
        )
        is_fallback = bool(items)
    for item in items:
        item["reason"] = (
            f"{item.get('institution')} 在 {item.get('topic') or '相关方向'} 上已有 {item.get('papers') or 0} 篇合作论文，"
            f"平均被引 {item.get('avg_cited') or 0}，适合作为优先了解的潜在合作对象。"
        )
        item["action"] = "查看代表论文、确认研究方向匹配度，再由学院或PI发起联系。"

    summary = {
        "candidates": len(items),
        "matched_works": base_stats.get("matched_works", 0),
        "matched_institutions": base_stats.get("matched_institutions", 0),
        "matched_countries": base_stats.get("matched_countries", 0),
        "year_range": f"{base_stats.get('start_year') or '-'}-{base_stats.get('end_year') or '-'}",
        "top_country": items[0]["country"] if items else "",
        "top_topic": items[0]["topic"] if items else "",
        "keyword": keyword,
        "status": "fallback" if is_fallback else ("matched" if items else "no_match"),
        "fallback": is_fallback,
    }
    return {"items": items, "keyword": keyword, "summary": summary}


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
    "/api/collaborators": collaborator_finder,
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
        if parsed.path == "/favicon.ico":
            self.path = "/favicon.svg"
            super().do_GET()
            return
        if parsed.path == "/api/me":
            self.send_json({"user": self.current_user()})
            return
        if parsed.path == "/api/admin/users":
            if not self.is_admin():
                self.send_json({"ok": False, "error": "Unauthorized"}, 401)
                return
            self.send_json({"ok": True, "users": list_users()})
            return
        if parsed.path == "/api/admin/access-requests":
            if not self.is_admin():
                self.send_json({"ok": False, "error": "Unauthorized"}, 401)
                return
            query = parse_qs(parsed.query)
            status = query.get("status", [None])[0]
            self.send_json({"ok": True, "requests": list_access_requests(status)})
            return
        if parsed.path == "/api/admin/data-status":
            if not self.is_admin():
                self.send_json({"ok": False, "error": "Unauthorized"}, 401)
                return
            seed_university_sources()
            self.send_json({"ok": True, **data_status()})
            return
        if parsed.path in API:
            query = parse_qs(parsed.query)
            limit = int(query.get("limit", ["20"])[0])
            university = query.get("university", [None])[0]
            user = self.current_user()
            access = self.access_level(user)
            limit = self.apply_limit(parsed.path, limit, access)
            handler = API[parsed.path]
            if parsed.path == "/api/collaborators":
                payload = handler(limit, university, query.get("keyword", [""])[0])
            elif parsed.path in {"/api/institutions", "/api/subjects", "/api/works"}:
                payload = handler(limit, university)
            elif parsed.path in {"/api/overview", "/api/map", "/api/collaboration", "/api/zombies", "/api/performance"}:
                payload = handler(university)
            else:
                payload = handler()
            payload = self.apply_payload_gate(parsed.path, payload, access)
            self.send_json(payload)
            return

        if parsed.path in {"/", "/map", "/institutions", "/subjects", "/benchmark", "/zombies", "/dashboard", "/performance", "/admin", "/login", "/pricing", "/finder"}:
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/auth/send-code":
                payload = self.read_json()
                phone = clean_required(payload.get("phone"), "phone")
                result = send_login_sms_code(phone)
                self.send_json({"ok": True, **result})
                return

            if parsed.path == "/api/auth/login":
                payload = self.read_json()
                phone = clean_required(payload.get("phone"), "phone")
                code = clean_required(payload.get("code"), "code")
                if not verify_login_sms_code(phone, code):
                    self.send_json({"ok": False, "error": "验证码错误或已过期"}, 400)
                    return
                user = get_or_create_user(
                    phone=phone,
                    name=(payload.get("name") or "").strip(),
                    organization=(payload.get("organization") or "").strip(),
                    role=(payload.get("role") or "").strip(),
                )
                token = create_session(user["id"])
                self.send_json({"ok": True, "user": user, "token": token})
                return

            if parsed.path == "/api/auth/logout":
                revoke_session(self.bearer_token())
                self.send_json({"ok": True})
                return

            if parsed.path == "/api/access-requests":
                payload = self.read_json()
                request = create_access_request(payload, self.current_user())
                notified = False
                try:
                    notified = notify_access_request(request)
                except Exception as exc:
                    print(f"Access request notification failed: {exc}")
                self.send_json({"ok": True, "request": request, "notified": notified})
                return

            if parsed.path == "/api/admin/access-requests/approve":
                if not self.is_admin():
                    self.send_json({"ok": False, "error": "Unauthorized"}, 401)
                    return
                payload = self.read_json()
                request = approve_access_request(int(payload.get("id") or 0))
                if not request:
                    self.send_json({"ok": False, "error": "Request not found"}, 404)
                    return
                self.send_json({"ok": True, "request": request})
                return

            if parsed.path == "/api/admin/access-requests/reject":
                if not self.is_admin():
                    self.send_json({"ok": False, "error": "Unauthorized"}, 401)
                    return
                payload = self.read_json()
                request = reject_access_request(int(payload.get("id") or 0))
                if not request:
                    self.send_json({"ok": False, "error": "Request not found"}, 404)
                    return
                self.send_json({"ok": True, "request": request})
                return

            if parsed.path == "/api/admin/access-requests/lead-status":
                if not self.is_admin():
                    self.send_json({"ok": False, "error": "Unauthorized"}, 401)
                    return
                payload = self.read_json()
                request = update_access_request_lead(
                    int(payload.get("id") or 0),
                    clean_required(payload.get("lead_status"), "lead_status"),
                    (payload.get("note") or "").strip(),
                )
                if not request:
                    self.send_json({"ok": False, "error": "Request not found"}, 404)
                    return
                self.send_json({"ok": True, "request": request})
                return

            if parsed.path == "/api/admin/access-requests/generate-data":
                if not self.is_admin():
                    self.send_json({"ok": False, "error": "Unauthorized"}, 401)
                    return
                payload = self.read_json()
                request_id = int(payload.get("id") or 0)
                request = update_access_request_lead(request_id, "contacted", "已触发数据生成")
                if not request:
                    self.send_json({"ok": False, "error": "Request not found"}, 404)
                    return
                university = clean_required(request.get("organization"), "organization")
                job = refresh_university(university, int(payload.get("limit_per_university") or 200))
                update_access_request_lead(request_id, "data_ready", "已生成或刷新该机构样例数据")
                self.send_json({"ok": True, "request": request, "job": job})
                return

            if parsed.path == "/api/admin/data/resolve-source":
                if not self.is_admin():
                    self.send_json({"ok": False, "error": "Unauthorized"}, 401)
                    return
                payload = self.read_json()
                university = clean_required(payload.get("university"), "university")
                source = resolve_source_metadata(university)
                self.send_json({"ok": True, "source": source})
                return

            if parsed.path == "/api/admin/data/refresh":
                if not self.is_admin():
                    self.send_json({"ok": False, "error": "Unauthorized"}, 401)
                    return
                payload = self.read_json()
                university = clean_required(payload.get("university"), "university")
                limit = payload.get("limit_per_university", 200)
                job = refresh_university(university, int(limit) if limit else None)
                self.send_json({"ok": True, "job": job})
                return

            self.send_json({"ok": False, "error": "Not found"}, 404)
        except ValueError as exc:
            self.send_json({"ok": False, "error": str(exc)}, 400)
        except Exception as exc:
            self.send_json({"ok": False, "error": str(exc)}, 500)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")

    def bearer_token(self) -> str | None:
        header = self.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            return header.removeprefix("Bearer ").strip()
        return None

    def current_user(self) -> dict | None:
        return user_by_session(self.bearer_token())

    def is_admin(self) -> bool:
        token = self.headers.get("X-Admin-Token", "")
        return bool(ADMIN_PASSWORD and token and token == ADMIN_PASSWORD)

    def access_level(self, user: dict | None) -> str:
        if not user:
            return "public"
        if user.get("status") == "active" or user.get("plan") == "institution":
            return "paid"
        return "login"

    def apply_limit(self, path: str, limit: int, access: str) -> int:
        caps = {
            "public": {"/api/institutions": 8, "/api/subjects": 8, "/api/works": 3, "/api/collaborators": 5},
            "login": {"/api/institutions": 20, "/api/subjects": 12, "/api/works": 8, "/api/collaborators": 12},
            "paid": {"/api/institutions": 100, "/api/subjects": 50, "/api/works": 50, "/api/collaborators": 50},
        }
        cap = caps.get(access, caps["public"]).get(path)
        return min(limit, cap) if cap else limit

    def apply_payload_gate(self, path: str, payload, access: str):
        meta = {
            "access": access,
            "locked": access != "paid",
            "message": "开通机构工作台后可查看完整明细、导出清单和生成报告。" if access != "paid" else "",
        }
        if path == "/api/collaborators":
            return {**payload, **meta}
        if path in {"/api/institutions", "/api/subjects", "/api/works", "/api/benchmark"}:
            return {"items": payload, **meta}
        if path == "/api/zombies":
            if access == "public":
                payload = {**payload, "partners": payload.get("partners", [])[:5]}
            elif access == "login":
                payload = {**payload, "partners": payload.get("partners", [])[:20]}
            return {**payload, **meta}
        if path == "/api/performance":
            if access == "public":
                payload = {**payload, "benchmarks": payload.get("benchmarks", [])[:3]}
            return {**payload, **meta}
        return payload

    def send_json(self, payload, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def clean_required(value: object, name: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{name} is required")
    return text


def main() -> None:
    port = int(os.getenv("WEB_PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Web app running at http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
