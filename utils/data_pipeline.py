from __future__ import annotations

import sqlite3
from pathlib import Path

from config import SQLITE_DB_PATH
from data.fetch_openalex import UNIVERSITIES, fetch_university, init_db, resolve_institution
from data.process_data import init_processed_tables, process_work
from utils.business_db import (
    create_data_job,
    list_data_jobs,
    list_university_sources,
    update_data_job,
    upsert_university_source,
    utc_now,
)


DEFAULT_LIMIT = 200


def seed_university_sources() -> list[dict]:
    sources = []
    for university, search_name in UNIVERSITIES.items():
        sources.append(upsert_university_source(university, search_name))
    return sources


def refresh_university(university: str, limit_per_university: int | None = DEFAULT_LIMIT) -> dict:
    seed_university_sources()
    search_name = UNIVERSITIES.get(university, university)

    job = create_data_job(university, limit_per_university)
    job_id = job["id"]
    update_data_job(job_id, status="running", started_at=utc_now())

    try:
        Path(SQLITE_DB_PATH).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(SQLITE_DB_PATH)
        init_db(conn)

        raw_count = fetch_university(conn, university, search_name, limit_per_university)
        raw_total = conn.execute("SELECT COUNT(*) FROM raw_works WHERE university = ?", (university,)).fetchone()[0]

        # Rebuild processed tables from all raw data so cross-school aggregates stay consistent.
        init_processed_tables(conn)
        rows = conn.execute("SELECT id, university, ror_id, payload FROM raw_works").fetchall()
        for row in rows:
            process_work(conn, row)
        conn.commit()
        processed_count = conn.execute("SELECT COUNT(*) FROM works WHERE university = ?", (university,)).fetchone()[0]
        conn.close()

        upsert_university_source(
            university,
            search_name,
            last_fetched_at=utc_now(),
            last_processed_at=utc_now(),
            raw_count=raw_total,
            work_count=processed_count,
        )
        return update_data_job(
            job_id,
            status="success",
            raw_count=raw_count,
            processed_count=processed_count,
            finished_at=utc_now(),
        ) or job
    except Exception as exc:
        update_data_job(job_id, status="failed", error=str(exc), finished_at=utc_now())
        raise


def resolve_source_metadata(university: str) -> dict:
    seed_university_sources()
    search_name = UNIVERSITIES.get(university, university)
    import requests

    session = requests.Session()
    openalex_id, ror_id = resolve_institution(session, university, search_name)
    return upsert_university_source(university, search_name, openalex_id=openalex_id, ror_id=ror_id)


def data_status() -> dict:
    return {
        "sources": list_university_sources() or seed_university_sources(),
        "jobs": list_data_jobs(),
    }
