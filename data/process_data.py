import json
import sqlite3
from pathlib import Path

import pycountry

from config import SQLITE_DB_PATH
def country_name(code: str | None) -> str:
    if not code:
        return ""
    country = pycountry.countries.get(alpha_2=code)
    return country.name if country else code


def primary_source_name(work: dict) -> str:
    source = (work.get("primary_location") or {}).get("source") or {}
    return source.get("display_name") or ""


def first_topic(work: dict) -> tuple[str, str]:
    topics = work.get("topics") or []
    if not topics:
        return "", ""
    topic = topics[0]
    domain = topic.get("domain") or {}
    return topic.get("display_name") or "", domain.get("display_name") or ""


def is_international(authorships: list[dict]) -> bool:
    for authorship in authorships:
        for institution in authorship.get("institutions") or []:
            code = institution.get("country_code")
            if code and code != "CN":
                return True
    return False


def is_lead(authorships: list[dict], ror_id: str) -> bool:
    if not authorships:
        return False
    first_author_institutions = authorships[0].get("institutions") or []
    return any(inst.get("ror") == ror_id for inst in first_author_institutions)


def init_processed_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        DROP TABLE IF EXISTS works;
        DROP TABLE IF EXISTS collaborations;

        CREATE TABLE works (
            id TEXT PRIMARY KEY,
            university TEXT NOT NULL,
            title TEXT,
            year INTEGER,
            cited_by INTEGER,
            journal TEXT,
            type TEXT,
            topic TEXT,
            domain TEXT,
            is_international BOOLEAN,
            is_lead BOOLEAN
        );

        CREATE TABLE collaborations (
            work_id TEXT NOT NULL,
            university TEXT NOT NULL,
            collab_institution TEXT NOT NULL,
            collab_country TEXT,
            collab_country_name TEXT,
            FOREIGN KEY(work_id) REFERENCES works(id)
        );

        CREATE INDEX idx_works_university_year ON works(university, year);
        CREATE INDEX idx_collab_university ON collaborations(university);
        """
    )
    conn.commit()


def process_work(conn: sqlite3.Connection, row: tuple[str, str, str, str]) -> None:
    work_id, university, ror_id, raw_payload = row
    work = json.loads(raw_payload)
    authorships = work.get("authorships") or []
    topic, domain = first_topic(work)
    international = is_international(authorships)
    lead = is_lead(authorships, ror_id)

    conn.execute(
        """
        INSERT INTO works (
            id, university, title, year, cited_by, journal, type, topic, domain,
            is_international, is_lead
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            work_id,
            university,
            work.get("title") or "",
            work.get("publication_year"),
            work.get("cited_by_count") or 0,
            primary_source_name(work),
            work.get("type") or "",
            topic,
            domain,
            int(international),
            int(lead),
        ),
    )

    if not international:
        return

    seen = set()
    for authorship in authorships:
        for institution in authorship.get("institutions") or []:
            ror = institution.get("ror")
            code = institution.get("country_code")
            name = institution.get("display_name")
            if not name or ror == ror_id or code == "CN":
                continue
            key = (work_id, name, code)
            if key in seen:
                continue
            seen.add(key)
            conn.execute(
                """
                INSERT INTO collaborations (
                    work_id, university, collab_institution, collab_country, collab_country_name
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (work_id, university, name, code or "", country_name(code)),
            )


def main() -> None:
    if not Path(SQLITE_DB_PATH).exists():
        raise SystemExit(f"SQLite database not found: {SQLITE_DB_PATH}. Run data/fetch_openalex.py first.")

    conn = sqlite3.connect(SQLITE_DB_PATH)
    init_processed_tables(conn)
    rows = conn.execute("SELECT id, university, ror_id, payload FROM raw_works").fetchall()
    for row in rows:
        process_work(conn, row)
    conn.commit()

    summary = conn.execute(
        """
        SELECT university, COUNT(*), SUM(is_international), SUM(is_lead)
        FROM works
        GROUP BY university
        ORDER BY university
        """
    ).fetchall()
    for university, total, international, lead in summary:
        print(f"{university}: total={total}, international={international or 0}, lead={lead or 0}")
    conn.close()


if __name__ == "__main__":
    main()
