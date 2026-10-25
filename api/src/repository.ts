// Every SQL statement of the app is here. No business rules: those are in rules.ts.

import type { DatabaseSync } from "node:sqlite";
import { DEFAULT_TIMEZONE } from "./database.js";
import type { DayTotal, Difficulty } from "./rules.js";

export interface QuestRow {
  id: number;
  title: string;
  difficulty: Difficulty;
  due_date: string | null;
  recurrence: "daily" | null;
  done: boolean;
}

export interface CompletionRow {
  id: number;
  quest_id: number;
  day: string;
  base_xp: number;
  created_at: string;
}

export interface NewQuest {
  title: string;
  difficulty: Difficulty;
  due_date: string | null;
  recurrence: "daily" | null;
  created_at: string;
}

export interface NewCompletion {
  quest_id: number;
  day: string;
  base_xp: number;
  created_at: string;
}

export type Repository = ReturnType<typeof createRepository>;

export function createRepository(db: DatabaseSync) {
  // Statements are prepared once and reused on every request.
  const sql = {
    insertQuest: db.prepare(
      `INSERT INTO quests (title, difficulty, due_date, recurrence, created_at)
       VALUES (:title, :difficulty, :due_date, :recurrence, :created_at)`,
    ),
    findQuest: db.prepare(`SELECT id, title, difficulty, due_date, recurrence, 0 AS done FROM quests WHERE id = ?`),
    // A one-off quest is done once it has any completion; a daily quest only for the given day.
    listQuests: db.prepare(
      `SELECT q.id, q.title, q.difficulty, q.due_date, q.recurrence,
              EXISTS (SELECT 1 FROM completions c
                      WHERE c.quest_id = q.id AND (q.recurrence IS NULL OR c.day = ?)) AS done
       FROM quests q
       ORDER BY q.created_at DESC, q.id DESC`,
    ),
    findCompletionOfQuest: db.prepare(`SELECT * FROM completions WHERE quest_id = ?`),
    findCompletionOfQuestOnDay: db.prepare(`SELECT * FROM completions WHERE quest_id = ? AND day = ?`),
    insertCompletion: db.prepare(
      `INSERT INTO completions (quest_id, day, base_xp, created_at)
       VALUES (:quest_id, :day, :base_xp, :created_at)`,
    ),
    findCompletion: db.prepare(`SELECT * FROM completions WHERE id = ?`),
    deleteCompletion: db.prepare(`DELETE FROM completions WHERE id = ?`),
    listCompletions: db.prepare(`SELECT * FROM completions ORDER BY created_at DESC, id DESC`),
    dayTotals: db.prepare(`SELECT day, SUM(base_xp) AS baseXp FROM completions GROUP BY day ORDER BY day`),
    getTimezone: db.prepare(`SELECT timezone FROM user_settings WHERE id = 1`),
    setTimezone: db.prepare(`UPDATE user_settings SET timezone = ? WHERE id = 1`),
  };

  /** Runs `work` as one atomic unit: either all its writes happen or none. */
  function inTransaction<T>(work: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  const asQuest = (row: unknown): QuestRow => {
    const quest = row as Omit<QuestRow, "done"> & { done: number };
    return { ...quest, done: quest.done === 1 };
  };

  return {
    inTransaction,

    insertQuest(quest: NewQuest): number {
      return Number(sql.insertQuest.run({ ...quest }).lastInsertRowid);
    },

    findQuest(id: number): QuestRow | undefined {
      const row = sql.findQuest.get(id);
      return row && asQuest(row);
    },

    /** `today` is only used to decide `done` for daily quests. */
    listQuests(today: string): QuestRow[] {
      return sql.listQuests.all(today).map(asQuest);
    },

    /** The active completion that blocks completing the quest again, if any. */
    findBlockingCompletion(quest: QuestRow, today: string): CompletionRow | undefined {
      const row =
        quest.recurrence === "daily"
          ? sql.findCompletionOfQuestOnDay.get(quest.id, today)
          : sql.findCompletionOfQuest.get(quest.id);
      return row as unknown as CompletionRow | undefined;
    },

    insertCompletion(completion: NewCompletion): CompletionRow {
      const id = Number(sql.insertCompletion.run({ ...completion }).lastInsertRowid);
      return { id, ...completion };
    },

    /** Deletes the completion. Returns false if it does not exist (never existed or already undone). */
    deleteCompletion(id: number): boolean {
      return Number(sql.deleteCompletion.run(id).changes) > 0;
    },

    listCompletions(): CompletionRow[] {
      return sql.listCompletions.all() as unknown as CompletionRow[];
    },

    dayTotals(): DayTotal[] {
      return sql.dayTotals.all() as unknown as DayTotal[];
    },

    getTimezone(): string {
      return (sql.getTimezone.get() as { timezone: string }).timezone;
    },

    setTimezone(timezone: string): void {
      sql.setTimezone.run(timezone);
    },

    /** Deletes everything, restarts the id counters and restores the default time zone. */
    resetAll(): void {
      inTransaction(() => {
        db.exec("DELETE FROM completions; DELETE FROM quests; DELETE FROM sqlite_sequence");
        sql.setTimezone.run(DEFAULT_TIMEZONE);
      });
    },
  };
}
