import json
import sqlite3
import time
from pathlib import Path

import requests

from config import SQLITE_DB_PATH


UNIVERSITIES = {
    "山东大学": "Shandong University",
    "四川大学": "Sichuan University",
    "武汉大学": "Wuhan University",
    "中山大学": "Sun Yat-sen University",
}

OPENALEX_WORKS_URL = "https://api.openalex.org/works"
OPENALEX_INSTITUTIONS_URL = "https://api.openalex.org/institutions"
PER_PAGE = 200


def init_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS raw_works (
            id TEXT PRIMARY KEY,
            university TEXT NOT NULL,
            ror_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_raw_works_university ON raw_works(university)")
    conn.commit()


def resolve_institution(session: requests.Session, university: str, search_name: str) -> tuple[str, str]:
    response = session.get(
        OPENALEX_INSTITUTIONS_URL,
        params={
            "search": search_name,
            "filter": "country_code:CN",
            "per-page": 5,
            "select": "id,ror,display_name,works_count",
        },
        timeout=30,
    )
    response.raise_for_status()
    results = response.json().get("results", [])
    if not results:
        raise RuntimeError(f"No OpenAlex institution found for {university} / {search_name}")

    exact = [item for item in results if item.get("display_name", "").lower() == search_name.lower()]
    institution = exact[0] if exact else results[0]
    openalex_id = institution["id"]
    ror_id = institution.get("ror") or ""
    print(
        f"{university}: resolved {institution.get('display_name')} "
        f"({openalex_id}, {ror_id}, works={institution.get('works_count')})"
    )
    return openalex_id, ror_id


def fetch_university(conn: sqlite3.Connection, university: str, search_name: str) -> int:
    cursor = "*"
    saved = 0
    session = requests.Session()
    openalex_id, ror_id = resolve_institution(session, university, search_name)

    while cursor:
        response = session.get(
            OPENALEX_WORKS_URL,
            params={
                "filter": f"institutions.id:{openalex_id}",
                "per-page": PER_PAGE,
                "cursor": cursor,
            },
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        works = payload.get("results", [])

        for work in works:
            work_id = work.get("id")
            if not work_id:
                continue
            conn.execute(
                """
                INSERT OR REPLACE INTO raw_works (id, university, ror_id, payload)
                VALUES (?, ?, ?, ?)
                """,
                (work_id, university, ror_id, json.dumps(work, ensure_ascii=False)),
            )
            saved += 1

        conn.commit()
        cursor = payload.get("meta", {}).get("next_cursor")
        if not works:
            break
        print(f"{university}: saved {saved} works")
        time.sleep(0.15)

    return saved


def main() -> None:
    Path(SQLITE_DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(SQLITE_DB_PATH)
    init_db(conn)

    try:
        for university, search_name in UNIVERSITIES.items():
            count = fetch_university(conn, university, search_name)
            print(f"[DONE] {university}: {count} works")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
