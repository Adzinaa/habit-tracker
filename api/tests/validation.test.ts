import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNewQuest, parseTimezoneUpdate } from "../src/validation.js";
import { formatId, parseId } from "../src/serializers.js";

const error = (body: unknown) => {
  const result = parseNewQuest(body);
  return result.ok ? null : result.error;
};

test("a minimal quest is valid and missing fields become null", () => {
  assert.deepEqual(parseNewQuest({ title: "Call grandma", difficulty: "easy" }), {
    ok: true,
    value: { title: "Call grandma", difficulty: "easy", due_date: null, recurrence: null },
  });
});

test("due_date and recurrence are accepted one at a time", () => {
  assert.equal(parseNewQuest({ title: "a", difficulty: "hard", due_date: "2026-10-06" }).ok, true);
  assert.equal(parseNewQuest({ title: "a", difficulty: "easy", recurrence: "daily" }).ok, true);
  assert.equal(parseNewQuest({ title: "a", difficulty: "easy", recurrence: "daily", due_date: null }).ok, true);
});

test("title must have 1 to 100 characters (recording line 8)", () => {
  assert.equal(error({ title: "", difficulty: "easy" }), "invalid title");
  assert.equal(error({ title: "a".repeat(101), difficulty: "easy" }), "invalid title");
  assert.equal(error({ title: "a".repeat(100), difficulty: "easy" }), null);
  assert.equal(error({ title: "🔥".repeat(100), difficulty: "easy" }), null);
  assert.equal(error({ title: "🔥".repeat(101), difficulty: "easy" }), "invalid title");
  assert.equal(error({ difficulty: "easy" }), "invalid title");
  assert.equal(error({ title: 42, difficulty: "easy" }), "invalid title");
});

test("difficulty must be easy, medium or hard (recording line 6)", () => {
  assert.equal(error({ title: "a", difficulty: "extreme" }), "invalid difficulty");
  assert.equal(error({ title: "a", difficulty: "EASY" }), "invalid difficulty");
  assert.equal(error({ title: "a" }), "invalid difficulty");
});

test("due_date and recurrence together are rejected (recording line 7)", () => {
  assert.equal(
    error({ title: "Stretch", difficulty: "easy", due_date: "2026-10-09", recurrence: "daily" }),
    "a quest cannot have both due_date and recurrence",
  );
});

test("due_date must be a real yyyy-mm-dd date and recurrence must be daily", () => {
  assert.equal(error({ title: "a", difficulty: "easy", due_date: "2026-02-30" }), "invalid due_date");
  assert.equal(error({ title: "a", difficulty: "easy", due_date: "tomorrow" }), "invalid due_date");
  assert.equal(error({ title: "a", difficulty: "easy", recurrence: "weekly" }), "invalid recurrence");
});

test("the body must be an object", () => {
  assert.notEqual(error(undefined), null);
  assert.notEqual(error(null), null);
  assert.notEqual(error("quest"), null);
});

test("parseTimezoneUpdate", () => {
  assert.deepEqual(parseTimezoneUpdate({ timezone: "America/New_York" }), { ok: true, value: "America/New_York" });
  assert.deepEqual(parseTimezoneUpdate({ timezone: "Mars/Olympus_Mons" }), { ok: false, error: "invalid timezone" });
  assert.deepEqual(parseTimezoneUpdate({}), { ok: false, error: "invalid timezone" });
  assert.deepEqual(parseTimezoneUpdate(undefined), { ok: false, error: "invalid timezone" });
});

test("ids: format and parse are inverse; anything else is rejected", () => {
  assert.equal(formatId("q", 7), "q7");
  assert.equal(parseId("q", "q7"), 7);
  assert.equal(parseId("q", "q99"), 99);
  assert.equal(parseId("q", "c7"), null);
  assert.equal(parseId("q", "7"), null);
  assert.equal(parseId("q", "q"), null);
  assert.equal(parseId("q", "q7; DROP TABLE quests"), null);
  assert.equal(parseId("c", "c-1"), null);
});
