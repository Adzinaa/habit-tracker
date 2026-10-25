import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const DEFAULT_TIMEZONE = "Europe/Bucharest";

// AUTOINCREMENT guarantees an id is never reused after a completion is undone.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS quests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    due_date   TEXT,
    recurrence TEXT CHECK (recurrence IS NULL OR recurrence = 'daily'),
    created_at TEXT NOT NULL,
    CHECK (due_date IS NULL OR recurrence IS NULL)
  );

  -- An undone completion is simply deleted: it must behave as if it never happened.
  CREATE TABLE IF NOT EXISTS completions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    quest_id   INTEGER NOT NULL REFERENCES quests(id),
    day        TEXT NOT NULL,
    base_xp    INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS completions_by_quest_and_day ON completions (quest_id, day);

  -- One user, so exactly one row.
  CREATE TABLE IF NOT EXISTS user_settings (
    id       INTEGER PRIMARY KEY CHECK (id = 1),
    timezone TEXT NOT NULL
  );
  INSERT OR IGNORE INTO user_settings (id, timezone) VALUES (1, '${DEFAULT_TIMEZONE}');
`;

/** Opens (and creates, if needed) the database. Use ":memory:" in tests. */
export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}
