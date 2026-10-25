# Choices where neither the spec nor the recording decides

Rules *confirmed* by the recording are in [RULES.md](RULES.md). Everything below is **my choice**,
not something the old app was seen to do. Items marked **(extrapolated)** go beyond the data.

## Rules extended beyond the data

| Choice | Why it is a guess |
| --- | --- |
| **(extrapolated)** Level `n` spans `100 * n` XP, also for level 4 and up. | Only levels 1, 2 and 3 appear (spans 100, 200, 300). It is the simplest rule that fits and satisfies "each level needs more". |
| **(extrapolated)** Late XP is `floor(base / 2)` for every difficulty, so a late hard quest gives 25. | Only easy (10 -> 5) and medium (25 -> 12) are late in the recording. |
| **(extrapolated)** The bonus stays at 14 for any streak above 8. | The cap is visible from streak 7 to 10, not beyond. |
| A day that has only late completions still earns the daily bonus. | The recording's late completions always share their day with another one. |
| A quest's lateness is decided by the local day of the completion, `day > due_date` (strictly after). | Lines 15 and 57 prove "on the due date" is not late; the rest follows. |

## Behaviour the sources do not describe

| Topic | Choice |
| --- | --- |
| `done` for a daily quest | True when it has an active completion **today**. The recording only shows `true` right after completing it. |
| Streak when the last completion day is *after* today | Counts as alive (can happen if the user moves to a zone further west, or the clock goes back). |
| Streak is not stored | Computed on every read from the completions and "today", so it can never drift. |
| Title | 1-100 **characters** (an emoji is 1), not trimmed: `"   "` is a valid title. |
| `due_date` | Must be a real `YYYY-MM-DD` date (`2026-02-30` is rejected). A date in the past is accepted. |
| `null` fields | `due_date: null` / `recurrence: null` mean "not set", same as omitting them. `recurrence` may only be `"daily"`. |
| Order of validation errors | title, difficulty, due_date, recurrence, "both". Messages for the first three are from the recording (lines 6-8); `invalid due_date` and `invalid recurrence` are mine. |
| Invalid `X-Now` | `400 {"error": "invalid X-Now header"}`. It must be ISO 8601 **with** an offset (or `Z`). |
| Time zone names | IANA names only. Offsets such as `+03:00` are rejected even though `Intl` would accept them. The name is stored exactly as sent. |
| "Newest first" | Sorted by creation time (the `X-Now` instant), ties broken by id, newest first. |
| Ids | `q<n>` and `c<n>`, from SQLite `AUTOINCREMENT`, so an undone completion's id is never reused. `POST /test/reset` restarts the counters at 1. |
| Undo | Deletes the row. "As if it never happened" and "404 when already undone" are then the same thing. |
| Malformed JSON, unknown routes | `400` / `404` with the usual `{"error": ...}` body. |
| `POST /test/reset` | Always available, as the spec requires; there is no auth (one user, no login). |

## Technical choices

| Choice | Reason |
| --- | --- |
| `node:sqlite` (built into Node) instead of `better-sqlite3` | No native build step on a clean machine, one dependency less. Needs Node >= 22.13. It is still flagged experimental in Node 22, which is why the scripts pass `--disable-warning=ExperimentalWarning`. |
| Synchronous SQLite + `BEGIN IMMEDIATE` around "check then insert" | A completion cannot be inserted twice, even if two requests arrive together. |
| Fastify is the only runtime dependency | Everything else (validation, time, ids) is a few lines and easier to explain than a library. |

## Weakest points

1. The three **extrapolated** rules above are untested against the old app.
2. `node:sqlite` is experimental in Node 22; its API could change in a later release.
3. Single process only: the "never twice" guarantee relies on one server and a synchronous database.
4. The Docker image is written but was **not built here** (no Docker daemon in the sandbox). The same steps run by hand were verified; see the README.
5. No CORS headers yet. A UI on another origin should call the API through a Next.js rewrite (or add `@fastify/cors`).

## AI Usage

I used AI to generate the initial Next.js boilerplate, UI components, Tailwind CSS styling, and the Docker Compose configuration, while I manually wrote, verified, and heavily tested the core domain logic, streak calculations, database queries, and timezone handling.

## Outside observations

I noticed that there is no pagination implemented or required for the `/quests` and `/completions` endpoints. Over time, as a user completes daily habits for months or years, these arrays will grow continuously, which could eventually degrade performance and bloat the UI. I left this unaddressed to strictly adhere to the provided API contract and recording behavior.