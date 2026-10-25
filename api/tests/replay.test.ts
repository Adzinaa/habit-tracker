import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { openDatabase } from "../src/database.js";
import { createRepository } from "../src/repository.js";
import { readRecording, replay, type RecordedRequest, type Send } from "../scripts/replay.js";

/** A send function that talks to a fresh in-memory app, without opening a port. */
function freshAppSender(): Send {
  const app = buildApp(createRepository(openDatabase(":memory:")));
  return async ({ method, path, headers, body }) => {
    const response = await app.inject({ method: method as "GET", url: path, headers, payload: body as object | undefined });
    return { status: response.statusCode, body: response.payload === "" ? undefined : response.json() };
  };
}

test("the reference recording replays with zero differences", async () => {
  const recording = readRecording();
  assert.equal(recording.length, 68);

  const mismatches = await replay(recording, freshAppSender());

  assert.deepEqual(mismatches, []);
});

test("the replay really detects differences (it does not pass vacuously)", async () => {
  const tampered: RecordedRequest[] = structuredClone(readRecording());

  // line 14: pretend the old app gave 99 XP instead of 26
  (tampered[13]!.response as { me: { xp: number } }).me.xp = 99;
  // line 38: pretend the undo answered 200
  tampered[37]!.status = 200;

  const mismatches = await replay(tampered, freshAppSender());

  assert.deepEqual(mismatches.map((mismatch) => mismatch.line), [14, 38]);
});
