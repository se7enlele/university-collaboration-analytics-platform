from __future__ import annotations

import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path


BUSINESS_DB_PATH = Path("data/business.db")
SESSION_DAYS = 14


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    BUSINESS_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(BUSINESS_DB_PATH)
    conn.row_factory = sqlite3.Row
    init_tables(conn)
    return conn


def init_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            organization TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT '',
            plan TEXT NOT NULL DEFAULT 'trial',
            status TEXT NOT NULL DEFAULT 'trial',
            created_at TEXT NOT NULL,
            last_login_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sms_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            code TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expired_at TEXT NOT NULL,
            used_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            expired_at TEXT NOT NULL,
            revoked_at TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS access_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            phone TEXT NOT NULL DEFAULT '',
            name TEXT NOT NULL DEFAULT '',
            organization TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT '',
            message TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            reviewed_at TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS university_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            university TEXT UNIQUE NOT NULL,
            search_name TEXT NOT NULL,
            ror_id TEXT NOT NULL DEFAULT '',
            openalex_id TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'enabled',
            last_fetched_at TEXT,
            last_processed_at TEXT,
            raw_count INTEGER NOT NULL DEFAULT 0,
            work_count INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS data_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            university TEXT NOT NULL,
            job_type TEXT NOT NULL DEFAULT 'refresh',
            status TEXT NOT NULL DEFAULT 'pending',
            limit_per_university INTEGER,
            raw_count INTEGER NOT NULL DEFAULT 0,
            processed_count INTEGER NOT NULL DEFAULT 0,
            error TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            started_at TEXT,
            finished_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
        CREATE INDEX IF NOT EXISTS idx_data_jobs_status ON data_jobs(status);
        """
    )
    ensure_column(conn, "access_requests", "source", "TEXT NOT NULL DEFAULT ''")
    ensure_column(conn, "access_requests", "lead_status", "TEXT NOT NULL DEFAULT 'new'")
    ensure_column(conn, "access_requests", "followup_note", "TEXT NOT NULL DEFAULT ''")
    ensure_column(conn, "access_requests", "updated_at", "TEXT")
    conn.commit()


def ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def row_to_user(row: sqlite3.Row | None) -> dict | None:
    if not row:
        return None
    return {
        "id": row["id"],
        "phone": row["phone"],
        "name": row["name"],
        "organization": row["organization"],
        "role": row["role"],
        "plan": row["plan"],
        "status": row["status"],
        "created_at": row["created_at"],
        "last_login_at": row["last_login_at"],
    }


def create_sms_code(phone: str, code: str | None = None) -> str:
    code = code or f"{secrets.randbelow(1_000_000):06d}"
    now = datetime.now(timezone.utc)
    expired_at = now + timedelta(minutes=10)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO sms_codes (phone, code, created_at, expired_at)
            VALUES (?, ?, ?, ?)
            """,
            (phone, code, now.isoformat(timespec="seconds"), expired_at.isoformat(timespec="seconds")),
        )
        conn.commit()
    return code


def verify_sms_code(phone: str, code: str) -> bool:
    now = utc_now()
    with connect() as conn:
        row = conn.execute(
            """
            SELECT id
            FROM sms_codes
            WHERE phone = ? AND code = ? AND used_at IS NULL AND expired_at > ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (phone, code, now),
        ).fetchone()
        if not row:
            return False
        conn.execute("UPDATE sms_codes SET used_at = ? WHERE id = ?", (now, row["id"]))
        conn.commit()
        return True


def get_or_create_user(phone: str, name: str = "", organization: str = "", role: str = "") -> dict:
    now = utc_now()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO users (phone, name, organization, role, created_at, last_login_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(phone) DO UPDATE SET
                name = CASE WHEN excluded.name != '' THEN excluded.name ELSE users.name END,
                organization = CASE WHEN excluded.organization != '' THEN excluded.organization ELSE users.organization END,
                role = CASE WHEN excluded.role != '' THEN excluded.role ELSE users.role END,
                last_login_at = excluded.last_login_at
            """,
            (phone, name, organization, role, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE phone = ?", (phone,)).fetchone()
    user = row_to_user(row)
    if not user:
        raise RuntimeError("User was not created")
    return user


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expired_at = now + timedelta(days=SESSION_DAYS)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO sessions (token, user_id, created_at, expired_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, user_id, now.isoformat(timespec="seconds"), expired_at.isoformat(timespec="seconds")),
        )
        conn.commit()
    return token


def user_by_session(token: str | None) -> dict | None:
    if not token:
        return None
    with connect() as conn:
        row = conn.execute(
            """
            SELECT users.*
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
              AND sessions.revoked_at IS NULL
              AND sessions.expired_at > ?
            """,
            (token, utc_now()),
        ).fetchone()
    return row_to_user(row)


def revoke_session(token: str | None) -> None:
    if not token:
        return
    with connect() as conn:
        conn.execute("UPDATE sessions SET revoked_at = ? WHERE token = ?", (utc_now(), token))
        conn.commit()


def create_access_request(payload: dict, user: dict | None = None) -> dict:
    now = utc_now()
    user_id = user["id"] if user else None
    phone = (payload.get("phone") or (user or {}).get("phone") or "").strip()
    name = (payload.get("name") or (user or {}).get("name") or "").strip()
    organization = (payload.get("organization") or (user or {}).get("organization") or "").strip()
    role = (payload.get("role") or (user or {}).get("role") or "").strip()
    message = (payload.get("message") or "").strip()
    source = (payload.get("source") or "").strip()
    lead_status = (payload.get("lead_status") or "new").strip()
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO access_requests (
                user_id, phone, name, organization, role, message, source, lead_status, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
            """,
            (user_id, phone, name, organization, role, message, source, lead_status, now, now),
        )
        conn.commit()
        request_id = cursor.lastrowid
    return {
        "id": request_id,
        "status": "pending",
        "phone": phone,
        "name": name,
        "organization": organization,
        "role": role,
        "message": message,
        "source": source,
        "lead_status": lead_status,
        "created_at": now,
    }


def list_users(limit: int = 100) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT
                users.*,
                (
                    SELECT COUNT(*)
                    FROM access_requests
                    WHERE access_requests.user_id = users.id
                       OR access_requests.phone = users.phone
                ) AS request_count
            FROM users
            ORDER BY users.created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def list_access_requests(status: str | None = None, limit: int = 100) -> list[dict]:
    sql = """
        SELECT
            access_requests.*,
            users.status AS user_status,
            users.plan AS user_plan
        FROM access_requests
        LEFT JOIN users ON users.id = access_requests.user_id
        {where}
        ORDER BY access_requests.created_at DESC
        LIMIT ?
    """
    params: tuple = (limit,)
    where = ""
    if status:
        where = "WHERE access_requests.status = ?"
        params = (status, limit)
    with connect() as conn:
        rows = conn.execute(sql.format(where=where), params).fetchall()
    return [dict(row) for row in rows]


def approve_access_request(request_id: int) -> dict | None:
    now = utc_now()
    with connect() as conn:
        request = conn.execute("SELECT * FROM access_requests WHERE id = ?", (request_id,)).fetchone()
        if not request:
            return None

        user_id = request["user_id"]
        if not user_id and request["phone"]:
            user = get_or_create_user(
                phone=request["phone"],
                name=request["name"],
                organization=request["organization"],
                role=request["role"],
            )
            user_id = user["id"]

        if user_id:
            conn.execute(
                """
                UPDATE users
                SET status = 'active',
                    plan = 'institution',
                    name = CASE WHEN ? != '' THEN ? ELSE name END,
                    organization = CASE WHEN ? != '' THEN ? ELSE organization END,
                    role = CASE WHEN ? != '' THEN ? ELSE role END
                WHERE id = ?
                """,
                (
                    request["name"],
                    request["name"],
                    request["organization"],
                    request["organization"],
                    request["role"],
                    request["role"],
                    user_id,
                ),
            )

        conn.execute(
            """
            UPDATE access_requests
            SET status = 'approved', reviewed_at = ?, user_id = COALESCE(user_id, ?)
            WHERE id = ?
            """,
            (now, user_id, request_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM access_requests WHERE id = ?", (request_id,)).fetchone()
    return dict(row) if row else None


def reject_access_request(request_id: int) -> dict | None:
    now = utc_now()
    with connect() as conn:
        request = conn.execute("SELECT * FROM access_requests WHERE id = ?", (request_id,)).fetchone()
        if not request:
            return None
        conn.execute(
            "UPDATE access_requests SET status = 'rejected', reviewed_at = ? WHERE id = ?",
            (now, request_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM access_requests WHERE id = ?", (request_id,)).fetchone()
    return dict(row) if row else None


def update_access_request_lead(request_id: int, lead_status: str, note: str = "") -> dict | None:
    allowed = {"new", "contacted", "data_ready", "converted", "abandoned"}
    if lead_status not in allowed:
        raise ValueError("Invalid lead status")
    now = utc_now()
    with connect() as conn:
        request = conn.execute("SELECT * FROM access_requests WHERE id = ?", (request_id,)).fetchone()
        if not request:
            return None
        conn.execute(
            """
            UPDATE access_requests
            SET lead_status = ?,
                followup_note = CASE WHEN ? != '' THEN ? ELSE followup_note END,
                updated_at = ?
            WHERE id = ?
            """,
            (lead_status, note, note, now, request_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM access_requests WHERE id = ?", (request_id,)).fetchone()
    return dict(row) if row else None


def upsert_university_source(university: str, search_name: str, **updates) -> dict:
    now = utc_now()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO university_sources (university, search_name, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(university) DO UPDATE SET
                search_name = excluded.search_name,
                updated_at = excluded.updated_at
            """,
            (university, search_name, now),
        )
        if updates:
            allowed = {
                "ror_id",
                "openalex_id",
                "status",
                "last_fetched_at",
                "last_processed_at",
                "raw_count",
                "work_count",
            }
            fields = [key for key in updates if key in allowed]
            if fields:
                assignments = ", ".join(f"{field} = ?" for field in fields)
                values = [updates[field] for field in fields]
                conn.execute(
                    f"UPDATE university_sources SET {assignments}, updated_at = ? WHERE university = ?",
                    (*values, now, university),
                )
        conn.commit()
        row = conn.execute("SELECT * FROM university_sources WHERE university = ?", (university,)).fetchone()
    return dict(row)


def list_university_sources() -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM university_sources
            ORDER BY updated_at DESC, university ASC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def create_data_job(university: str, limit_per_university: int | None = None) -> dict:
    now = utc_now()
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO data_jobs (university, limit_per_university, created_at)
            VALUES (?, ?, ?)
            """,
            (university, limit_per_university, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM data_jobs WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return dict(row)


def update_data_job(job_id: int, **updates) -> dict | None:
    if not updates:
        return None
    allowed = {"status", "raw_count", "processed_count", "error", "started_at", "finished_at"}
    fields = [key for key in updates if key in allowed]
    if not fields:
        return None
    assignments = ", ".join(f"{field} = ?" for field in fields)
    values = [updates[field] for field in fields]
    with connect() as conn:
        conn.execute(f"UPDATE data_jobs SET {assignments} WHERE id = ?", (*values, job_id))
        conn.commit()
        row = conn.execute("SELECT * FROM data_jobs WHERE id = ?", (job_id,)).fetchone()
    return dict(row) if row else None


def list_data_jobs(limit: int = 50) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM data_jobs
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]
