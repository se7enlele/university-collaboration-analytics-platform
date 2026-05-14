from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from config import MYSQL_DB, MYSQL_HOST, MYSQL_PASSWORD, MYSQL_PORT, MYSQL_USER


def get_engine() -> Engine:
    url = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}?charset=utf8mb4"
    return create_engine(url, pool_pre_ping=True)


def init_mysql_tables(engine: Engine | None = None) -> None:
    engine = engine or get_engine()
    statements = [
        """
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            phone VARCHAR(20) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_paid BOOLEAN DEFAULT FALSE,
            paid_at TIMESTAMP NULL,
            paid_until TIMESTAMP NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS sms_codes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            phone VARCHAR(20) NOT NULL,
            code VARCHAR(6) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expired_at TIMESTAMP NOT NULL,
            is_used BOOLEAN DEFAULT FALSE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS payment_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            phone VARCHAR(20) NOT NULL,
            alipay_trade_no VARCHAR(50) NOT NULL,
            amount DECIMAL(10,2) DEFAULT 19.90,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status ENUM('pending','approved','rejected') DEFAULT 'pending',
            reviewed_at TIMESTAMP NULL
        )
        """,
    ]
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))


def get_or_create_user(phone: str, engine: Engine | None = None) -> dict:
    engine = engine or get_engine()
    with engine.begin() as conn:
        conn.execute(text("INSERT IGNORE INTO users (phone) VALUES (:phone)"), {"phone": phone})
        row = conn.execute(text("SELECT * FROM users WHERE phone = :phone"), {"phone": phone}).mappings().one()
    return dict(row)


def set_sms_code(phone: str, code: str, engine: Engine | None = None) -> None:
    engine = engine or get_engine()
    expired_at = datetime.now() + timedelta(minutes=5)
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO sms_codes (phone, code, expired_at) VALUES (:phone, :code, :expired_at)"),
            {"phone": phone, "code": code, "expired_at": expired_at},
        )


def verify_sms_code(phone: str, code: str, engine: Engine | None = None) -> bool:
    engine = engine or get_engine()
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT id FROM sms_codes
                WHERE phone = :phone AND code = :code AND is_used = FALSE AND expired_at > NOW()
                ORDER BY id DESC
                LIMIT 1
                """
            ),
            {"phone": phone, "code": code},
        ).first()
        if not row:
            return False
        conn.execute(text("UPDATE sms_codes SET is_used = TRUE WHERE id = :id"), {"id": row[0]})
        return True


def create_payment_request(phone: str, trade_no: str, engine: Engine | None = None) -> None:
    engine = engine or get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO payment_requests (phone, alipay_trade_no)
                VALUES (:phone, :trade_no)
                """
            ),
            {"phone": phone, "trade_no": trade_no},
        )


def approve_payment(request_id: int, engine: Engine | None = None) -> None:
    engine = engine or get_engine()
    paid_until = datetime.now() + timedelta(days=365)
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT phone FROM payment_requests WHERE id = :id"),
            {"id": request_id},
        ).first()
        if not row:
            return
        conn.execute(
            text("UPDATE users SET is_paid = TRUE, paid_at = NOW(), paid_until = :paid_until WHERE phone = :phone"),
            {"phone": row[0], "paid_until": paid_until},
        )
        conn.execute(
            text("UPDATE payment_requests SET status = 'approved', reviewed_at = NOW() WHERE id = :id"),
            {"id": request_id},
        )


def reject_payment(request_id: int, engine: Engine | None = None) -> None:
    engine = engine or get_engine()
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE payment_requests SET status = 'rejected', reviewed_at = NOW() WHERE id = :id"),
            {"id": request_id},
        )
