// Turns database rows into the JSON the API promises, and handles the public ids.
// Ids look like "q7" and "c12": a letter plus the database number.

import type { CompletionRow, QuestRow } from "./repository.js";

export const QUEST_PREFIX = "q";
export const COMPLETION_PREFIX = "c";

export function formatId(prefix: string, id: number): string {
  return `${prefix}${id}`;
}

/** "q7" -> 7. Returns null for anything that is not a well-formed id of that kind. */
export function parseId(prefix: string, text: string): number | null {
  const match = new RegExp(`^${prefix}(\\d{1,15})$`).exec(text);
  return match ? Number(match[1]) : null;
}

export function questToJson(quest: QuestRow) {
  return {
    id: formatId(QUEST_PREFIX, quest.id),
    title: quest.title,
    difficulty: quest.difficulty,
    due_date: quest.due_date,
    recurrence: quest.recurrence,
    done: quest.done,
  };
}

export function completionToJson(completion: CompletionRow) {
  return {
    id: formatId(COMPLETION_PREFIX, completion.id),
    quest_id: formatId(QUEST_PREFIX, completion.quest_id),
    day: completion.day,
    base_xp: completion.base_xp,
    created_at: completion.created_at,
  };
}
