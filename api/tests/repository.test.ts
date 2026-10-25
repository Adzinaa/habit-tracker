import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/database.js";
import { createRepository } from "../src/repository.js";

const newQuest = { title: "Read", difficulty: "easy", due_date: null, recurrence: null, created_at: "2026-10-05T06:00:00Z" } as const;

function memoryRepository() {
  return createRepository(openDatabase(":memory:"));
}

test("data survives closing and reopening the database file", () => {
  const folder = mkdtempSync(join(tmpdir(), "habit-"));
  try {
    const file = join(folder, "nested", "app.db");

    const first = openDatabase(file);
    const repository = createRepository(first);
    const questId = repository.insertQuest(newQuest);
    repository.insertCompletion({ quest_id: questId, day: "2026-10-05", base_xp: 10, created_at: "2026-10-05T06:00:00Z" });
    repository.setTimezone("America/New_York");
    first.close();

    const reopened = createRepository(openDatabase(file));
    assert.equal(reopened.listQuests("2026-10-05").length, 1);
    assert.equal(reopened.listCompletions().length, 1);
    assert.equal(reopened.getTimezone(), "America/New_York");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("a new database starts in Europe/Bucharest", () => {
  assert.equal(memoryRepository().getTimezone(), "Europe/Bucharest");
});

test("deleteCompletion reports whether something was deleted", () => {
  const repository = memoryRepository();
  const questId = repository.insertQuest(newQuest);
  const { id } = repository.insertCompletion({ quest_id: questId, day: "2026-10-05", base_xp: 10, created_at: "2026-10-05T06:00:00Z" });
  assert.equal(repository.deleteCompletion(id), true);
  assert.equal(repository.deleteCompletion(id), false);
  assert.equal(repository.deleteCompletion(999), false);
});

test("ids of deleted completions are never reused", () => {
  const repository = memoryRepository();
  const questId = repository.insertQuest(newQuest);
  const completion = { quest_id: questId, day: "2026-10-05", base_xp: 10, created_at: "2026-10-05T06:00:00Z" };
  const first = repository.insertCompletion(completion);
  repository.deleteCompletion(first.id);
  assert.equal(repository.insertCompletion(completion).id, first.id + 1);
});

test("resetAll removes everything, restarts ids and restores the time zone", () => {
  const repository = memoryRepository();
  const questId = repository.insertQuest(newQuest);
  repository.insertCompletion({ quest_id: questId, day: "2026-10-05", base_xp: 10, created_at: "2026-10-05T06:00:00Z" });
  repository.setTimezone("Asia/Tokyo");

  repository.resetAll();

  assert.deepEqual(repository.listQuests("2026-10-05"), []);
  assert.deepEqual(repository.listCompletions(), []);
  assert.deepEqual(repository.dayTotals(), []);
  assert.equal(repository.getTimezone(), "Europe/Bucharest");
  assert.equal(repository.insertQuest(newQuest), 1);
});

test("inTransaction rolls back when the work throws", () => {
  const repository = memoryRepository();
  assert.throws(() =>
    repository.inTransaction(() => {
      repository.insertQuest(newQuest);
      throw new Error("boom");
    }),
  );
  assert.deepEqual(repository.listQuests("2026-10-05"), []);
});

test("dayTotals sums base_xp per day, ascending", () => {
  const repository = memoryRepository();
  const a = repository.insertQuest(newQuest);
  const b = repository.insertQuest(newQuest);
  const at = (day: string, quest_id: number, base_xp: number) =>
    repository.insertCompletion({ quest_id, day, base_xp, created_at: `${day}T06:00:00Z` });
  at("2026-10-07", a, 10);
  at("2026-10-06", a, 10);
  at("2026-10-06", b, 50);
  // node:sqlite rows have a null prototype; spread them into plain objects to compare.
  assert.deepEqual(repository.dayTotals().map((row) => ({ ...row })), [
    { day: "2026-10-06", baseXp: 60 },
    { day: "2026-10-07", baseXp: 10 },
  ]);
});
