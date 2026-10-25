# Rules deduced from the recording

Line numbers refer to `api/tests/fixtures/reference_recording.jsonl` (1-based).
Every rule below was checked against **all** the lines listed, not just one example.

## XP

| Rule | Evidence |
| --- | --- |
| Base XP is 10 / 25 / 50 for easy / medium / hard. | 9, 15, 29 |
| A one-off quest completed **after** its due date earns **half, rounded down**: medium 25 -> 12, easy 10 -> 5. | 17 (due 10-07, done 10-08), 25 (due 10-10, done 10-12) |
| Completing **on** the due date is not late. Lateness compares the user's *local* day with `due_date`, never the UTC day. | 15 (due 10-06, done 10-06 23:40), 57 (due 10-21, done 22:30 New York = 02:30Z on 10-22, still 50 XP) |
| `base_xp` in a completion is the value **already reduced** for lateness. | 17, 25 |
| Daily bonus = `min(2 * streak, 14)`, where `streak` is the length of the run of consecutive days that ends on that day (including it). Values seen: 2, 4, 6, 8, 10, 12, 14, then 14 again. | 9 (+2), 14 (+4), 16 (+6), 17 (+8), 20 (+10), 21 (+12), 23 (+14), 24 (streak 8, still +14), 27, 31 |
| The bonus is earned **once per day**, by the day's first completion only. Further completions on the same day add just `base_xp`. | 15 (+50), 18 (+10), 25 (+5), 29 (+50), 66 (+50) |

## Levels

| Rule | Evidence |
| --- | --- |
| Level `n` needs `100 * n` XP, so level 1 = 0-99, level 2 = 100-299, level 3 = 300-599, level 4 starts at 600. Each level needs more than the previous one. | 1 (100 to next), 17 (xp 112 -> level 2, 12 into 200), 31 (xp 315 -> level 3, 15 into 300), 67 (xp 547 -> 53 to next, i.e. 600) |
| `xp_into_level + xp_to_next_level` always equals the span of the current level. | every `me` |

## Streak

| Rule | Evidence |
| --- | --- |
| The streak is the run of consecutive local days with at least one active completion. | 9, 14, 16 |
| It is computed **at read time** from "today" (from `X-Now` and the user's time zone). The run stays alive if the last completion day is today **or yesterday**. | 33 (10-15 22:00, last day 10-14 -> still 10) |
| With a gap of one or more full days the current streak is 0 until the next completion. | 34 (10-16 07:00 -> 0) |
| After a gap, a new completion starts a new run at 1 (bonus back to +2). | 35, 61 |

## Undo

| Rule | Evidence |
| --- | --- |
| Undo removes the completion and **everything is recomputed from the remaining completions**: XP, bonuses and streak are never patched incrementally. | 38-40 |
| Example 1: c15 and c16 are on the same day. Before the undo XP is 337 (315 + 10 + 2 bonus + 10); after undoing c15 it is 327 (315 + 10 + 2), because the day still earns its single +2 bonus, now attached to c16. | 36, 40 |
| Example 2: undoing c17 splits the run 16, (17), 18. c18 now has streak 1, so its bonus falls from 6 to 2, and the streak falls from 3 to 1. XP 357 -> 339. | 43-46 |
| An undone or unknown completion answers 404 `completion not found`. | 39 |
| After undo the quest can be completed again, and its `done` flag goes back to `false`. | 35 -> 38 -> 41 (q4 `done: false`), 47 (q4 completed again) |
| Completion ids are never reused (a failed create does not consume an id either). | 47 (c19 after the undone c17), 19 (q5 right after the three rejected creates) |

## `done` flag on quests

| Rule | Evidence |
| --- | --- |
| One-off quest: `done` = it has an active completion (any day). | 12, 41, 53, 68 |
| Daily quest: `done` = it has an active completion **today** (in the user's time zone at the request time). | 12 (true after completing today), 41, 53, 68 |

## Time zones and time

| Rule | Evidence |
| --- | --- |
| A completion's `day` is the local calendar day in the user's time zone **at that moment**, and it is stored. Changing the time zone later does not move old completions. | 52, 54, 57, 60 |
| `created_at` is the `X-Now` instant converted to UTC, formatted `YYYY-MM-DDTHH:MM:SSZ` (no milliseconds). | 9, 54, 57 |
| Completing the daily quest again on the same local day, after the zone change, returns the existing completion with 200 (10-19 20:30 in New York is already 10-20 in Bucharest, but the stored day 10-19 matches). | 49, 52 |
| Changing the zone keeps XP; the streak is re-evaluated against "today" in the new zone. | 51, 58, 59 |
| An invalid zone answers 400 `invalid timezone` and changes nothing. | 50, 51 |
| Daylight saving time ends in Bucharest on 2026-10-25; days are calendar days, not 24-hour blocks. | 62, 63, 64 |

## Lists and errors

| Rule | Evidence |
| --- | --- |
| Quests are listed newest first, completions newest first. | 12, 41, 53, 68 / 37, 60 |
| Error bodies are `{"error": "<message>"}`: `invalid difficulty`, `invalid title`, `a quest cannot have both due_date and recurrence`, `quest not found`, `completion not found`, `invalid timezone`. | 6, 7, 8, 11, 39, 50 |
| A repeated completion returns **200** with the same completion and the unchanged `me`; no XP is awarded. | 10, 48, 52 |
