import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .config import get_settings
from .models import Entry, EntryCreate, EntryUpdate


def _connection() -> sqlite3.Connection:
    path = Path(get_settings().database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with _connection() as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                mood TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT 'Untitled moment',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT '',
                insight TEXT,
                reflection TEXT,
                goal TEXT,
                tags TEXT NOT NULL DEFAULT '[]'
            )"""
        )
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(entries)")}
        if "title" not in columns:
            connection.execute("ALTER TABLE entries ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled moment'")
        if "updated_at" not in columns:
            connection.execute("ALTER TABLE entries ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''")
        if "goal" not in columns:
            connection.execute("ALTER TABLE entries ADD COLUMN goal TEXT")
        connection.execute("UPDATE entries SET updated_at = created_at WHERE updated_at = ''")


def _entry(row: sqlite3.Row) -> Entry:
    return Entry(
        id=row["id"], content=row["content"], mood=row["mood"],
        title=row["title"],
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"] or row["created_at"]),
        insight=row["insight"], reflection=row["reflection"], goal=row["goal"],
        tags=json.loads(row["tags"]),
    )


def list_entries(limit: int = 30) -> list[Entry]:
    with _connection() as connection:
        rows = connection.execute(
            "SELECT * FROM entries ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [_entry(row) for row in rows]


def get_entry(entry_id: int) -> Entry | None:
    with _connection() as connection:
        row = connection.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    return _entry(row) if row else None


def create_entry(payload: EntryCreate, title: str, insight: str, reflection: str, goal: str, tags: list[str]) -> Entry:
    created_at = datetime.now(timezone.utc).replace(microsecond=0)
    with _connection() as connection:
        cursor = connection.execute(
            "INSERT INTO entries (content, mood, title, created_at, updated_at, insight, reflection, goal, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (payload.content, payload.mood, title, created_at.isoformat(), created_at.isoformat(), insight, reflection, goal, json.dumps(tags)),
        )
        entry_id = cursor.lastrowid
    return get_entry(entry_id)


def update_entry(entry_id: int, payload: EntryUpdate, title: str, insight: str, reflection: str, goal: str, tags: list[str]) -> Entry | None:
    updated_at = datetime.now(timezone.utc).replace(microsecond=0)
    with _connection() as connection:
        connection.execute(
            "UPDATE entries SET content = ?, mood = ?, title = ?, updated_at = ?, insight = ?, reflection = ?, goal = ?, tags = ? WHERE id = ?",
            (payload.content, payload.mood, title, updated_at.isoformat(), insight, reflection, goal, json.dumps(tags), entry_id),
        )
    return get_entry(entry_id)


def delete_entry(entry_id: int) -> bool:
    with _connection() as connection:
        cursor = connection.execute("DELETE FROM entries WHERE id = ?", (entry_id,))
    return cursor.rowcount > 0
