## Background and task

A small habit tracker turns everyday tasks into quests. Finishing a quest earns XP, XP fills levels, and showing up day after day builds a streak. Users only believe the numbers if they never jump twice, vanish on refresh, or reset at the wrong midnight.

An earlier version of this app was written years ago and is being retired. Its source code is lost. What survives is a short written spec (below, incomplete) and a recording of real requests and responses (`reference_recording.jsonl`). Your job is to rebuild it:

- A **Fastify API in TypeScript** that behaves exactly like the old one.
- A **Next.js UI** on top of it.
- Storage is your choice (SQLite is fine), but data must survive a server restart.
- We must be able to install and run it easily on a clean machine. Docker is preferred: `docker compose up` should start the API on port 3001 and the UI on port 3000. Without Docker, one command from your README must do the same.
- There is one user and no login. Do not build auth, multiple users, deployment to a server or a design system.

Correct behaviour and how you explain it come first; right after that, we care a lot about a UI that looks great. Where neither the spec nor the recording settles something, make a choice and write it down.

**We encourage you to use AI as much as possible, for anything you see fit.** We only ask that you understand and can explain everything you send.

## The written spec

This is everything that was written down. It is correct, but it is not complete.

1. A quest has a title (1–100 characters) and a difficulty: `easy`, `medium` or `hard`, worth 10, 25 and 50 XP. It may have a due date or repeat daily, but not both.
2. A one-off quest can be completed once. A daily quest can be completed once per day. Completing a quest again returns the existing completion and awards nothing.
3. A completion belongs to the calendar day it was made on, in the user's time zone at that moment. The default time zone is `Europe/Bucharest`; the user can change it.
4. Completing a one-off quest after its due date earns less XP.
5. Every day with at least one completion earns a bonus that depends on the streak.
6. Any completion can be undone at any time. It is then treated as if it never happened, and the quest can be completed again.
7. Each level needs more XP than the one before.
8. The user sees their total XP, their level, their progress through it, and their current streak.

## The recording

`reference_recording.jsonl` holds 68 requests made to the old app between 5 and 26 October 2026, in order, with the responses it gave. Several rules in the spec above are only fully defined there: work them out from the data. Where your API and the recording disagree, the recording is right.

Each line is one request. `x_now` is the time it was made (sent as the `X-Now` header, see below), `body` appears only when the request had one, and `response` is absent when the server returned no body.

```
{"x_now": "2026-10-05T09:15:00+03:00", "method": "POST", "path": "/quests/q1/complete", "status": 201,
 "response": {"completion": {"id": "c1", "quest_id": "q1", "day": "2026-10-05", "base_xp": 10, "created_at": "2026-10-05T06:15:00Z"},
              "me": {"timezone": "Europe/Bucharest", "xp": 12, "level": 1, "xp_into_level": 12, "xp_to_next_level": 88, "streak": 1}}}
```

The IDs (`q1`, `c1`) are the old app's. Yours can look different; we map them when we test. We will run your API against this recording and against others you have not seen, built from the same rules.

## API contract

All bodies are JSON. Errors return `{"error": "<message>"}`; the message is free text. IDs are strings.

**Time.** Any request may carry an `X-Now` header with an ISO 8601 timestamp including its offset. When present, the server must treat it as the current time; without it, use the real clock.

| Method and path | Body | Success | Errors |
| --- | --- | --- | --- |
| `POST /quests` | `title`, `difficulty`, optional `due_date` (`yyyy-mm-dd`) or `recurrence: "daily"` | 201 + quest | 400 invalid input |
| `GET /quests` | — | 200 + all quests, newest first | — |
| `POST /quests/:id/complete` | — | 201 + `{completion, me}` for a new completion; 200 + `{completion, me}` with the existing one | 404 unknown quest |
| `GET /completions` | — | 200 + completions that have not been undone, newest first | — |
| `DELETE /completions/:id` | — | 204 | 404 unknown or already undone |
| `GET /me` | — | 200 + me | — |
| `PUT /me` | `timezone` | 200 + me | 400 not a valid IANA time zone |
| `POST /test/reset` | — | 204, all data deleted | — |

Response shapes:

```
quest:      { id, title, difficulty, due_date, recurrence, done }
completion: { id, quest_id, day, base_xp, created_at }
me:         { timezone, xp, level, xp_into_level, xp_to_next_level, streak }
```

The recording shows what each field holds.

## The UI

One page is enough, built in Next.js on top of your API. **We really appreciate great, beautiful design.** A page that looks polished and feels good to use counts clearly in your favour. Treat the XP bar, the level-up moment and the streak as the heart of the experience. It should feel rewarding, not like an admin panel.

- An XP bar showing level, progress through the level and the current streak.
- A form to create a quest: title, difficulty, and either a due date or daily.
- The quest list, with a Complete button on each, done quests marked, and overdue one-off quests flagged.
- Recent completions, each with an Undo button.

The feedback must feel instant and stay truthful. When the user completes a quest, the XP bar moves right away and a level-up is visible. Whatever the UI shows must end up matching what the server says, whatever happens to the request.

## What to send back

1. A link to a Git repository, with a README that explains how to install and run everything. AI-written instructions are fine, as long as they work when we follow them step by step on a clean machine. We will try.
2. Evidence it works: your own tests, including a replay of the recording against your API.
3. Every rule you found in the recording that the spec does not state, each with the line numbers that show it.
4. Half a page covering what you did, how you verified it, and what you deliberately did not do. Include every choice you made where neither source was clear.
5. Where your solution is weakest.
6. One line on what you used AI for and what you checked by hand.
7. Anything you noticed outside the task and did not fix.
