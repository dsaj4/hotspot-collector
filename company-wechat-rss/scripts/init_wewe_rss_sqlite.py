import argparse
import sqlite3
from pathlib import Path


CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT NOT NULL PRIMARY KEY,
    token TEXT NOT NULL,
    name TEXT NOT NULL,
    status INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feeds (
    id TEXT NOT NULL PRIMARY KEY,
    mp_name TEXT NOT NULL,
    mp_cover TEXT NOT NULL,
    mp_intro TEXT NOT NULL,
    status INTEGER NOT NULL DEFAULT 1,
    sync_time INTEGER NOT NULL DEFAULT 0,
    update_time INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
    id TEXT NOT NULL PRIMARY KEY,
    mp_id TEXT NOT NULL,
    title TEXT NOT NULL,
    pic_url TEXT NOT NULL,
    publish_time INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
"""


def ensure_has_history_column(connection: sqlite3.Connection) -> None:
    columns = [
        row[1]
        for row in connection.execute('PRAGMA table_info("feeds")').fetchall()
    ]
    if "has_history" not in columns:
        connection.execute(
            'ALTER TABLE "feeds" ADD COLUMN "has_history" INTEGER DEFAULT 1'
        )


def init_database(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    try:
        connection.executescript(CREATE_TABLES_SQL)
        ensure_has_history_column(connection)
        connection.commit()
    finally:
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Initialize the SQLite schema required by the vendored wewe-rss server."
    )
    parser.add_argument("--db-path", required=True, help="Absolute SQLite database path.")
    args = parser.parse_args()
    init_database(Path(args.db_path))
    print(f"Initialized SQLite schema at {Path(args.db_path).resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
