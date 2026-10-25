// Checks what comes in from the outside. Error messages follow the recording.

import { DIFFICULTIES, type Difficulty } from "./rules.js";
import { isValidDay, isValidTimeZone } from "./time.js";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export interface ValidQuest {
  title: string;
  difficulty: Difficulty;
  due_date: string | null;
  recurrence: "daily" | null;
}

const MAX_TITLE_LENGTH = 100;

export function parseNewQuest(body: unknown): Result<ValidQuest> {
  if (typeof body !== "object" || body === null) return fail("request body must be a JSON object");
  const { title, difficulty, due_date, recurrence } = body as Record<string, unknown>;

  // Length is counted in characters (code points), so an emoji counts as 1.
  if (typeof title !== "string" || [...title].length < 1 || [...title].length > MAX_TITLE_LENGTH) {
    return fail("invalid title");
  }
  if (typeof difficulty !== "string" || !DIFFICULTIES.includes(difficulty as Difficulty)) {
    return fail("invalid difficulty");
  }
  // `null` and a missing field both mean "not set".
  if (due_date != null && !isValidDay(due_date)) return fail("invalid due_date");
  if (recurrence != null && recurrence !== "daily") return fail("invalid recurrence");
  if (due_date != null && recurrence != null) return fail("a quest cannot have both due_date and recurrence");

  return {
    ok: true,
    value: {
      title,
      difficulty: difficulty as Difficulty,
      due_date: due_date ?? null,
      recurrence: recurrence ?? null,
    },
  };
}

export function parseTimezoneUpdate(body: unknown): Result<string> {
  const timezone = typeof body === "object" && body !== null ? (body as Record<string, unknown>).timezone : undefined;
  return isValidTimeZone(timezone) ? { ok: true, value: timezone } : fail("invalid timezone");
}
