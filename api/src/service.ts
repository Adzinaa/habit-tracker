// The use cases. Glue between the pure rules (rules.ts) and the database (repository.ts).

import type { CompletionRow, QuestRow, Repository } from "./repository.js";
import { baseXp, computeProgress, levelFor } from "./rules.js";
import { localDay, toUtcIso } from "./time.js";

/** The user's current local day: "now" seen through the user's time zone. */
export function currentDay(repository: Repository, now: Date): string {
  return localDay(now, repository.getTimezone());
}

/** The `me` object: total XP, level, progress and streak, computed from the stored completions. */
export function buildMe(repository: Repository, now: Date) {
  const { xp, streak } = computeProgress(repository.dayTotals(), currentDay(repository, now));
  return { timezone: repository.getTimezone(), xp, ...levelFor(xp), streak };
}

/**
 * Completes a quest "now". If it is already completed (a one-off ever, a daily one
 * today) nothing is stored and the existing completion is returned.
 */
export function completeQuest(
  repository: Repository,
  quest: QuestRow,
  now: Date,
): { completion: CompletionRow; isNew: boolean } {
  return repository.inTransaction(() => {
    const today = currentDay(repository, now);

    const existing = repository.findBlockingCompletion(quest, today);
    if (existing) return { completion: existing, isNew: false };

    // Late = the user's local day is after the due date. Completing ON the due date is fine.
    const isLate = quest.due_date !== null && today > quest.due_date;
    const completion = repository.insertCompletion({
      quest_id: quest.id,
      day: today,
      base_xp: baseXp(quest.difficulty, isLate),
      created_at: toUtcIso(now),
    });
    return { completion, isNew: true };
  });
}
