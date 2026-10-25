import { test } from "node:test";
import assert from "node:assert/strict";
import { dayNumber, isValidDay, isValidTimeZone, localDay, parseInstant, toUtcIso } from "../src/time.js";

const BUCHAREST = "Europe/Bucharest";

test("localDay follows the zone, not UTC", () => {
  // 23:30 in New York (UTC-4) is already the next day in UTC and in Bucharest.
  const instant = new Date("2026-10-19T23:30:00-04:00");
  assert.equal(localDay(instant, "America/New_York"), "2026-10-19");
  assert.equal(localDay(instant, "UTC"), "2026-10-20");
  assert.equal(localDay(instant, BUCHAREST), "2026-10-20");
});

test("localDay switches at local midnight (summer time, UTC+3)", () => {
  assert.equal(localDay(new Date("2026-10-05T20:59:59Z"), BUCHAREST), "2026-10-05");
  assert.equal(localDay(new Date("2026-10-05T21:00:00Z"), BUCHAREST), "2026-10-06");
});

test("localDay across the autumn DST change (2026-10-25, 04:00 -> 03:00)", () => {
  // Before the change Bucharest is UTC+3, after it UTC+2.
  assert.equal(localDay(new Date("2026-10-24T21:00:00Z"), BUCHAREST), "2026-10-25");
  assert.equal(localDay(new Date("2026-10-25T21:59:59Z"), BUCHAREST), "2026-10-25");
  assert.equal(localDay(new Date("2026-10-25T22:00:00Z"), BUCHAREST), "2026-10-26");
});

test("localDay across the spring DST change (2026-03-29, 03:00 -> 04:00)", () => {
  assert.equal(localDay(new Date("2026-03-28T22:00:00Z"), BUCHAREST), "2026-03-29");
  assert.equal(localDay(new Date("2026-03-29T20:59:59Z"), BUCHAREST), "2026-03-29");
  assert.equal(localDay(new Date("2026-03-29T21:00:00Z"), BUCHAREST), "2026-03-30");
});

test("isValidTimeZone accepts IANA names only", () => {
  assert.equal(isValidTimeZone("Europe/Bucharest"), true);
  assert.equal(isValidTimeZone("America/Argentina/Buenos_Aires"), true);
  assert.equal(isValidTimeZone("UTC"), true);
  assert.equal(isValidTimeZone("Mars/Olympus_Mons"), false);
  assert.equal(isValidTimeZone("+03:00"), false);
  assert.equal(isValidTimeZone(""), false);
  assert.equal(isValidTimeZone(42), false);
  assert.equal(isValidTimeZone(undefined), false);
});

test("parseInstant needs an offset and a real date", () => {
  assert.equal(parseInstant("2026-10-05T09:15:00+03:00")?.toISOString(), "2026-10-05T06:15:00.000Z");
  assert.equal(parseInstant("2026-10-05T06:15:00Z")?.toISOString(), "2026-10-05T06:15:00.000Z");
  assert.equal(parseInstant("2026-10-05T09:15:00"), null);
  assert.equal(parseInstant("yesterday"), null);
  assert.equal(parseInstant("2026-13-45T09:15:00Z"), null);
});

test("toUtcIso drops milliseconds", () => {
  assert.equal(toUtcIso(new Date("2026-10-05T09:15:00.789+03:00")), "2026-10-05T06:15:00Z");
});

test("isValidDay rejects impossible dates", () => {
  assert.equal(isValidDay("2026-10-07"), true);
  assert.equal(isValidDay("2028-02-29"), true);
  assert.equal(isValidDay("2026-02-30"), false);
  assert.equal(isValidDay("2026-10-7"), false);
  assert.equal(isValidDay("07-10-2026"), false);
  assert.equal(isValidDay(20261007), false);
});

test("dayNumber of consecutive days differs by one, even over DST changes", () => {
  assert.equal(dayNumber("2026-10-26") - dayNumber("2026-10-25"), 1);
  assert.equal(dayNumber("2026-03-30") - dayNumber("2026-03-29"), 1);
  assert.equal(dayNumber("2026-03-01") - dayNumber("2026-02-28"), 1);
});
