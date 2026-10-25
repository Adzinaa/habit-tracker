import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { openDatabase } from "../src/database.js";
import { createRepository } from "../src/repository.js";
import { localDay } from "../src/time.js";

/** A fresh in-memory API. `call` sends one request; `now` becomes the X-Now header. */
function newApi() {
  const app = buildApp(createRepository(openDatabase(":memory:")));

  // `any` keeps the assertions short: the responses are checked field by field below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Json = any;

  async function call(method: string, url: string, options: { now?: string; body?: unknown } = {}) {
    const response = await app.inject({
      method: method as "GET",
      url,
      headers: options.now ? { "x-now": options.now } : {},
      payload: options.body as object | undefined,
    });
    return { status: response.statusCode, body: (response.payload === "" ? undefined : response.json()) as Json };
  }

  const createQuest = async (body: object, now = "2026-10-05T08:00:00+03:00") => (await call("POST", "/quests", { now, body })).body.id as string;
  const complete = (questId: string, now: string) => call("POST", `/quests/${questId}/complete`, { now });
  const me = async (now: string) => (await call("GET", "/me", { now })).body as Json;

  return { call, createQuest, complete, me };
}

const DAILY = { title: "Water", difficulty: "easy", recurrence: "daily" } as const;

// ---- quests ---------------------------------------------------------------

test("POST /quests: 100 characters are fine, 101 are not, errors are { error }", async () => {
  const { call } = newApi();
  const ok = await call("POST", "/quests", { body: { title: "a".repeat(100), difficulty: "easy" } });
  assert.equal(ok.status, 201);
  const tooLong = await call("POST", "/quests", { body: { title: "a".repeat(101), difficulty: "easy" } });
  assert.equal(tooLong.status, 400);
  assert.deepEqual(Object.keys(tooLong.body), ["error"]);
});

test("a rejected quest does not use up an id", async () => {
  const { call, createQuest } = newApi();
  await call("POST", "/quests", { body: { title: "", difficulty: "easy" } });
  assert.equal(await createQuest({ title: "First", difficulty: "easy" }), "q1");
});

test("GET /quests lists newest first", async () => {
  const { call, createQuest } = newApi();
  await createQuest({ title: "one", difficulty: "easy" }, "2026-10-05T08:00:00+03:00");
  await createQuest({ title: "two", difficulty: "easy" }, "2026-10-05T08:00:00+03:00"); // same instant
  await createQuest({ title: "three", difficulty: "easy" }, "2026-10-05T08:01:00+03:00");
  const { body } = await call("GET", "/quests");
  assert.deepEqual(body.map((quest: { title: string }) => quest.title), ["three", "two", "one"]);
});

test("done: a daily quest is done today only, a one-off quest forever", async () => {
  const { call, createQuest, complete } = newApi();
  const daily = await createQuest(DAILY);
  const oneOff = await createQuest({ title: "Once", difficulty: "easy" });
  await complete(daily, "2026-10-05T09:00:00+03:00");
  await complete(oneOff, "2026-10-05T09:00:00+03:00");

  const sameDay = (await call("GET", "/quests", { now: "2026-10-05T23:59:00+03:00" })).body;
  const nextDay = (await call("GET", "/quests", { now: "2026-10-06T00:01:00+03:00" })).body;
  const done = (list: Array<{ id: string; done: boolean }>) => Object.fromEntries(list.map((q) => [q.id, q.done]));
  assert.deepEqual(done(sameDay), { [daily]: true, [oneOff]: true });
  assert.deepEqual(done(nextDay), { [daily]: false, [oneOff]: true });
});

// ---- completing -----------------------------------------------------------

test("unknown or malformed quest ids answer 404", async () => {
  const { call } = newApi();
  for (const id of ["q99", "abc", "q", "c1", "1"]) {
    const response = await call("POST", `/quests/${id}/complete`);
    assert.equal(response.status, 404, id);
    assert.deepEqual(response.body, { error: "quest not found" });
  }
});

test("a repeated completion returns 200 and awards nothing", async () => {
  const { complete, createQuest } = newApi();
  const quest = await createQuest({ title: "Once", difficulty: "hard" });
  const first = await complete(quest, "2026-10-05T09:00:00+03:00");
  const again = await complete(quest, "2026-10-09T09:00:00+03:00"); // a one-off is done for good
  assert.equal(first.status, 201);
  assert.equal(again.status, 200);
  assert.deepEqual(again.body, { completion: first.body.completion, me: { ...first.body.me, streak: 0 } });
  assert.equal(again.body.me.xp, 52);
});

test("level-up: crossing 100 XP moves to level 2", async () => {
  const { createQuest, complete } = newApi();
  const a = await createQuest({ title: "a", difficulty: "hard" });
  const b = await createQuest({ title: "b", difficulty: "hard" });
  const first = await complete(a, "2026-10-05T09:00:00+03:00");
  assert.equal(first.body.me.level, 1);
  const second = await complete(b, "2026-10-05T10:00:00+03:00");
  assert.deepEqual(second.body.me, {
    timezone: "Europe/Bucharest", xp: 102, level: 2, xp_into_level: 2, xp_to_next_level: 198, streak: 1,
  });
});

test("late XP: on the due date it is full, the day after it is halved", async () => {
  const { createQuest, complete } = newApi();
  const onTime = await createQuest({ title: "a", difficulty: "medium", due_date: "2026-10-07" });
  const late = await createQuest({ title: "b", difficulty: "medium", due_date: "2026-10-07" });
  const veryLate = await createQuest({ title: "c", difficulty: "hard", due_date: "2026-10-01" });

  assert.equal((await complete(onTime, "2026-10-07T23:59:59+03:00")).body.completion.base_xp, 25);
  assert.equal((await complete(late, "2026-10-08T00:00:00+03:00")).body.completion.base_xp, 12);
  assert.equal((await complete(veryLate, "2026-10-08T09:00:00+03:00")).body.completion.base_xp, 25);
});

test("lateness uses the user's local day, not the UTC day", async () => {
  const { call, createQuest, complete } = newApi();
  await call("PUT", "/me", { body: { timezone: "America/New_York" } });
  const quest = await createQuest({ title: "Passport", difficulty: "hard", due_date: "2026-10-21" });
  // 22:30 on 10-21 in New York is already 10-22 in UTC and in Bucharest.
  const response = await complete(quest, "2026-10-21T22:30:00-04:00");
  assert.equal(response.body.completion.day, "2026-10-21");
  assert.equal(response.body.completion.base_xp, 50);
});

test("a completion belongs to the local day: midnight splits two days", async () => {
  const { createQuest, complete } = newApi();
  const quest = await createQuest(DAILY);
  const beforeMidnight = await complete(quest, "2026-10-05T23:59:59+03:00");
  const afterMidnight = await complete(quest, "2026-10-06T00:00:00+03:00");
  assert.equal(beforeMidnight.body.completion.day, "2026-10-05");
  assert.equal(afterMidnight.status, 201);
  assert.equal(afterMidnight.body.completion.day, "2026-10-06");
  assert.equal(afterMidnight.body.me.streak, 2);
  assert.equal(afterMidnight.body.me.xp, 12 + 14);
});

test("the offset in X-Now does not matter, only the instant and the user's zone", async () => {
  const { createQuest, complete } = newApi();
  const quest = await createQuest(DAILY);
  // 06:15Z written with two different offsets is the same Bucharest day, the same instant.
  const first = await complete(quest, "2026-10-05T09:15:00+03:00");
  const second = await complete(quest, "2026-10-05T06:15:00Z");
  assert.equal(second.status, 200);
  assert.deepEqual(second.body.completion, first.body.completion);
});

test("spring DST: a 23-hour day is one day, and the next day continues the streak", async () => {
  const { createQuest, complete } = newApi();
  const quest = await createQuest(DAILY, "2026-03-28T08:00:00+02:00");
  const early = await complete(quest, "2026-03-29T00:30:00+02:00");
  const late = await complete(quest, "2026-03-29T23:30:00+03:00"); // 22 hours later, same calendar day
  const next = await complete(quest, "2026-03-30T08:00:00+03:00");
  assert.equal(early.status, 201);
  assert.equal(late.status, 200);
  assert.equal(next.status, 201);
  assert.equal(next.body.me.streak, 2);
});

test("autumn DST: a 25-hour day is one day, and the next day continues the streak", async () => {
  const { createQuest, complete } = newApi();
  const quest = await createQuest(DAILY, "2026-10-24T08:00:00+03:00");
  const early = await complete(quest, "2026-10-25T00:30:00+03:00");
  const late = await complete(quest, "2026-10-25T23:30:00+02:00"); // exactly 24 hours later, same calendar day
  const next = await complete(quest, "2026-10-26T00:10:00+02:00");
  assert.equal(early.status, 201);
  assert.equal(late.status, 200);
  assert.equal(next.status, 201);
  assert.equal(next.body.me.streak, 2);
});

// ---- streak and time zones ------------------------------------------------

test("streak: alive until the end of the next day, then 0, then restarts at 1", async () => {
  const { createQuest, complete, me } = newApi();
  const quest = await createQuest(DAILY);
  await complete(quest, "2026-10-05T09:00:00+03:00");
  assert.equal((await me("2026-10-06T23:59:00+03:00")).streak, 1);
  assert.equal((await me("2026-10-07T00:00:00+03:00")).streak, 0);
  assert.equal((await complete(quest, "2026-10-07T09:00:00+03:00")).body.me.streak, 1);
});

test("changing the time zone keeps old days and re-evaluates the streak against the new 'today'", async () => {
  const { call, createQuest, complete } = newApi();
  const quest = await createQuest(DAILY);
  await complete(quest, "2026-10-05T09:00:00+03:00");
  await complete(quest, "2026-10-06T00:30:00+03:00"); // Bucharest day 10-06, still 10-05 evening in New York

  const changed = await call("PUT", "/me", { now: "2026-10-06T00:40:00+03:00", body: { timezone: "America/New_York" } });
  assert.equal(changed.body.timezone, "America/New_York");
  assert.equal(changed.body.xp, 12 + 14);
  // Days 10-05 and 10-06 are consecutive, so the run is 2 long. Its last day (10-06) is
  // "tomorrow" in New York, and that must not kill it.
  assert.equal(changed.body.streak, 2);

  const stored = (await call("GET", "/completions")).body.map((c: { day: string }) => c.day);
  assert.deepEqual(stored, ["2026-10-06", "2026-10-05"]);
});

test("PUT /me rejects an invalid zone and keeps the old one", async () => {
  const { call } = newApi();
  for (const body of [{ timezone: "Mars/Olympus_Mons" }, { timezone: "+03:00" }, {}, { timezone: 5 }]) {
    const response = await call("PUT", "/me", { body });
    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "invalid timezone" });
  }
  assert.equal((await call("GET", "/me")).body.timezone, "Europe/Bucharest");
});

// ---- undo -----------------------------------------------------------------

test("undo in the middle of a run recalculates bonuses and streak", async () => {
  const { call, createQuest, complete, me } = newApi();
  const quest = await createQuest(DAILY);
  await complete(quest, "2026-10-05T09:00:00+03:00");
  const middle = await complete(quest, "2026-10-06T09:00:00+03:00");
  await complete(quest, "2026-10-07T09:00:00+03:00");
  const before = await me("2026-10-07T10:00:00+03:00");
  assert.equal(before.xp, 12 + 14 + 16);
  assert.equal(before.streak, 3);

  assert.equal((await call("DELETE", `/completions/${middle.body.completion.id}`)).status, 204);

  const after = await me("2026-10-07T10:00:00+03:00");
  assert.equal(after.xp, 12 + 12);
  assert.equal(after.streak, 1);
});

test("undoing the only completion returns to zero", async () => {
  const { call, createQuest, complete, me } = newApi();
  const quest = await createQuest({ title: "x", difficulty: "hard" });
  const done = await complete(quest, "2026-10-05T09:00:00+03:00");
  await call("DELETE", `/completions/${done.body.completion.id}`);
  assert.deepEqual(await me("2026-10-05T09:01:00+03:00"), {
    timezone: "Europe/Bucharest", xp: 0, level: 1, xp_into_level: 0, xp_to_next_level: 100, streak: 0,
  });
});

test("after an undo the quest can be completed again, with a new completion id", async () => {
  const { call, createQuest, complete } = newApi();
  const oneOff = await createQuest({ title: "once", difficulty: "easy" });
  const daily = await createQuest(DAILY);
  for (const quest of [oneOff, daily]) {
    const first = await complete(quest, "2026-10-05T09:00:00+03:00");
    await call("DELETE", `/completions/${first.body.completion.id}`);
    const second = await complete(quest, "2026-10-05T10:00:00+03:00");
    assert.equal(second.status, 201);
    assert.notEqual(second.body.completion.id, first.body.completion.id);
  }
});

test("undo: second attempt, unknown and malformed ids answer 404; undone ones leave the list", async () => {
  const { call, createQuest, complete } = newApi();
  const quest = await createQuest(DAILY);
  const { body } = await complete(quest, "2026-10-05T09:00:00+03:00");
  const url = `/completions/${body.completion.id}`;

  assert.equal((await call("DELETE", url)).status, 204);
  assert.deepEqual((await call("DELETE", url)).body, { error: "completion not found" });
  assert.equal((await call("DELETE", "/completions/c999")).status, 404);
  assert.equal((await call("DELETE", "/completions/nope")).status, 404);
  assert.deepEqual((await call("GET", "/completions")).body, []);
});

test("GET /completions lists newest first", async () => {
  const { call, createQuest, complete } = newApi();
  const quest = await createQuest(DAILY);
  for (const now of ["2026-10-05T09:00:00+03:00", "2026-10-06T09:00:00+03:00", "2026-10-07T09:00:00+03:00"]) {
    await complete(quest, now);
  }
  const days = (await call("GET", "/completions")).body.map((c: { day: string }) => c.day);
  assert.deepEqual(days, ["2026-10-07", "2026-10-06", "2026-10-05"]);
});

// ---- reset, clock, headers ------------------------------------------------

test("POST /test/reset deletes everything, restarts the ids and restores the time zone", async () => {
  const { call, createQuest, complete } = newApi();
  const quest = await createQuest(DAILY);
  await complete(quest, "2026-10-05T09:00:00+03:00");
  await call("PUT", "/me", { body: { timezone: "Asia/Tokyo" } });

  const reset = await call("POST", "/test/reset");
  assert.equal(reset.status, 204);
  assert.equal(reset.body, undefined);

  assert.deepEqual((await call("GET", "/quests")).body, []);
  assert.deepEqual((await call("GET", "/completions")).body, []);
  assert.deepEqual((await call("GET", "/me")).body, {
    timezone: "Europe/Bucharest", xp: 0, level: 1, xp_into_level: 0, xp_to_next_level: 100, streak: 0,
  });
  assert.equal(await createQuest(DAILY), "q1");
});

test("without X-Now the real clock is used", async () => {
  const { call } = newApi();
  const quest = (await call("POST", "/quests", { body: DAILY })).body.id; // no X-Now here either
  const before = localDay(new Date(), "Europe/Bucharest");
  const response = await call("POST", `/quests/${quest}/complete`);
  const after = localDay(new Date(), "Europe/Bucharest");

  assert.equal(response.status, 201);
  assert.ok([before, after].includes(response.body.completion.day));
  assert.match(response.body.completion.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.equal(response.body.me.streak, 1);
});

test("an invalid X-Now header is a 400", async () => {
  const { call } = newApi();
  for (const now of ["yesterday", "2026-10-05T09:15:00", "2026-13-01T00:00:00Z"]) {
    const response = await call("GET", "/me", { now });
    assert.equal(response.status, 400, now);
    assert.deepEqual(Object.keys(response.body), ["error"]);
  }
});

test("malformed JSON and unknown routes answer { error }", async () => {
  const app = buildApp(createRepository(openDatabase(":memory:")));
  const badJson = await app.inject({ method: "POST", url: "/quests", headers: { "content-type": "application/json" }, payload: "{oops" });
  assert.equal(badJson.statusCode, 400);
  assert.deepEqual(Object.keys(badJson.json()), ["error"]);

  const missing = await app.inject({ method: "GET", url: "/nope" });
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(Object.keys(missing.json()), ["error"]);
});

test("an empty body with a JSON content type is accepted where no body is needed", async () => {
  const app = buildApp(createRepository(openDatabase(":memory:")));
  const created = await app.inject({ method: "POST", url: "/quests", payload: { title: "x", difficulty: "easy" } });
  const response = await app.inject({
    method: "POST", url: `/quests/${created.json().id}/complete`, headers: { "content-type": "application/json" },
  });
  assert.equal(response.statusCode, 201);
});
