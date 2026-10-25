import { test } from "node:test";
import assert from "node:assert/strict";
import { baseXp, computeProgress, dailyBonus, levelFor, type DayTotal } from "../src/rules.js";

const days = (...entries: Array<[string, number]>): DayTotal[] =>
  entries.map(([day, baseXp]) => ({ day, baseXp }));

test("baseXp: 10 / 25 / 50, half rounded down when late", () => {
  assert.equal(baseXp("easy", false), 10);
  assert.equal(baseXp("medium", false), 25);
  assert.equal(baseXp("hard", false), 50);
  assert.equal(baseXp("easy", true), 5);
  assert.equal(baseXp("medium", true), 12);
  assert.equal(baseXp("hard", true), 25);
});

test("dailyBonus grows by 2 per streak day and is capped at 14", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(dailyBonus), [2, 4, 6, 8, 10, 12, 14]);
  assert.equal(dailyBonus(8), 14);
  assert.equal(dailyBonus(365), 14);
});

test("levelFor matches the recording", () => {
  assert.deepEqual(levelFor(0), { level: 1, xp_into_level: 0, xp_to_next_level: 100 });
  assert.deepEqual(levelFor(99), { level: 1, xp_into_level: 99, xp_to_next_level: 1 });
  assert.deepEqual(levelFor(100), { level: 2, xp_into_level: 0, xp_to_next_level: 200 });
  assert.deepEqual(levelFor(112), { level: 2, xp_into_level: 12, xp_to_next_level: 188 });
  assert.deepEqual(levelFor(299), { level: 2, xp_into_level: 199, xp_to_next_level: 1 });
  assert.deepEqual(levelFor(315), { level: 3, xp_into_level: 15, xp_to_next_level: 285 });
  assert.deepEqual(levelFor(547), { level: 3, xp_into_level: 247, xp_to_next_level: 53 });
  assert.deepEqual(levelFor(600), { level: 4, xp_into_level: 0, xp_to_next_level: 400 });
});

test("every level needs more XP than the previous one", () => {
  let previousSpan = 0;
  for (let level = 1; level <= 30; level++) {
    const start = 50 * level * (level - 1);
    const { level: found, xp_into_level, xp_to_next_level } = levelFor(start);
    assert.equal(found, level);
    assert.equal(xp_into_level, 0);
    assert.ok(xp_to_next_level > previousSpan);
    previousSpan = xp_to_next_level;
  }
});

test("computeProgress: no completions", () => {
  assert.deepEqual(computeProgress([], "2026-10-05"), { xp: 0, streak: 0 });
});

test("computeProgress: first day earns base + 2", () => {
  assert.deepEqual(computeProgress(days(["2026-10-05", 10]), "2026-10-05"), { xp: 12, streak: 1 });
});

test("computeProgress: several completions on one day earn the bonus once", () => {
  // recording lines 14-15: 10 + 4, then +50 with no extra bonus
  const progress = computeProgress(days(["2026-10-05", 10], ["2026-10-06", 60]), "2026-10-06");
  assert.deepEqual(progress, { xp: 12 + 60 + 4, streak: 2 });
});

test("computeProgress: bonus is capped from streak 7 on", () => {
  const week = days(
    ["2026-10-05", 10], ["2026-10-06", 10], ["2026-10-07", 10], ["2026-10-08", 10],
    ["2026-10-09", 10], ["2026-10-10", 10], ["2026-10-11", 10], ["2026-10-12", 10],
  );
  // bonuses 2+4+6+8+10+12+14+14 = 70
  assert.deepEqual(computeProgress(week, "2026-10-12"), { xp: 80 + 70, streak: 8 });
});

test("computeProgress: streak is alive today or yesterday, dead after a gap", () => {
  const run = days(["2026-10-13", 10], ["2026-10-14", 10]);
  assert.equal(computeProgress(run, "2026-10-14").streak, 2);
  assert.equal(computeProgress(run, "2026-10-15").streak, 2);
  assert.equal(computeProgress(run, "2026-10-16").streak, 0);
});

test("computeProgress: a gap restarts the run at 1 but keeps the XP earned", () => {
  const progress = computeProgress(days(["2026-10-14", 10], ["2026-10-16", 10]), "2026-10-16");
  assert.deepEqual(progress, { xp: 12 + 12, streak: 1 });
});

test("computeProgress: the day is a calendar day, DST does not break the run", () => {
  const progress = computeProgress(days(["2026-10-24", 10], ["2026-10-25", 10], ["2026-10-26", 10]), "2026-10-26");
  assert.deepEqual(progress, { xp: 30 + 2 + 4 + 6, streak: 3 });
});

test("computeProgress: undo cases from the recording are recomputed, not patched", () => {
  // lines 40, 46: after undoing c17 the days are 10-16 and 10-18 only
  const before = computeProgress(days(["2026-10-16", 20], ["2026-10-17", 10], ["2026-10-18", 10]), "2026-10-18");
  const after = computeProgress(days(["2026-10-16", 20], ["2026-10-18", 10]), "2026-10-18");
  assert.equal(before.streak, 3);
  assert.equal(after.streak, 1);
  assert.equal(before.xp - after.xp, 10 + 4 + (6 - 2));
});

test("computeProgress: a last completion day after today still counts as alive", () => {
  // can happen when the user moves west or the clock goes back
  assert.equal(computeProgress(days(["2026-10-26", 10]), "2026-10-25").streak, 1);
});
