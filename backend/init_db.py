"""
SQLite database initialization for SMS Gateway.
Run once: python init_db.py
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "data.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS contacts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name  TEXT    NOT NULL DEFAULT '',
    last_name   TEXT    NOT NULL DEFAULT '',
    mobile      TEXT    NOT NULL DEFAULT '',
    landline    TEXT    NOT NULL DEFAULT '',
    city        TEXT    NOT NULL DEFAULT '',
    department  TEXT    NOT NULL DEFAULT '',
    company     TEXT    NOT NULL DEFAULT '',
    province    TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_mobile ON contacts(mobile);

CREATE TABLE IF NOT EXISTS templates (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL DEFAULT '',
    body       TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scheduled_sms (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        mobile            TEXT    NOT NULL,
        message           TEXT    NOT NULL,
        scheduled_at_utc  TEXT    NOT NULL,
        status            TEXT    NOT NULL DEFAULT 'pending',
        retries           INTEGER NOT NULL DEFAULT 0,
        max_retries       INTEGER NOT NULL DEFAULT 3,
        created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
        sent_at           TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_sms(status);
    CREATE INDEX IF NOT EXISTS idx_scheduled_retries ON scheduled_sms(retries);
"""


def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.executescript(SCHEMA)
    conn.close()
    print(f"Database initialized at {DB_PATH}")


if __name__ == "__main__":
    init_db()
