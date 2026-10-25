# Habit tracker: API

Fastify + TypeScript + SQLite rebuild of the retired habit-tracker API.
Backend only for now; the Next.js UI can be added later as a sibling folder.

```
api/            the API
  src/          time.ts, rules.ts (pure) | database.ts, repository.ts (SQL) | validation.ts,
                serializers.ts, service.ts, app.ts (HTTP) | config.ts, server.ts
  tests/        unit, API and replay tests (fixtures/reference_recording.jsonl)
  scripts/      replay.ts: replays the recording against a running server
docs/RULES.md       every rule found in the recording, with line numbers
docs/DECISIONS.md   every choice the sources do not settle, and the weak points
```

## Run it

### With Docker (preferred)

```bash
docker compose up
```

The API listens on <http://localhost:3001>. The database is stored in the `api-data` volume, so data survives
`docker compose down` and restarts. `docker compose down -v` deletes it.

### Without Docker

Needs **Node.js 22.13 or newer** (the built-in `node:sqlite` module). Check with `node -v`.

```bash
cd api && npm install && npm start
```

`npm start` compiles the TypeScript and starts the server on port 3001. The database file is created at
`api/data/habit-tracker.db`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | HTTP port |
| `HOST` | `0.0.0.0` | Interface to listen on |
| `DATABASE_PATH` | `data/habit-tracker.db` (`/data/habit-tracker.db` in Docker) | SQLite file; missing folders are created |

For development with auto-restart: `npm run dev`.

## Test it

```bash
cd api
npm test            # unit + API tests + replay of the recording, in memory
npm run typecheck
```

Replay the recording against a **running** server (it resets the data first):

```bash
npm run replay                         # http://localhost:3001
npm run replay -- http://localhost:3001
```

Expected: `68/68 requests match the recording`.

## API

Errors are always `{"error": "<message>"}`. Any request may send `X-Now: <ISO 8601 with offset>` to set the
current time; without it the real clock is used.

| Method and path | Success | Errors |
| --- | --- | --- |
| `POST /quests` | 201 quest | 400 |
| `GET /quests` | 200 list, newest first | |
| `POST /quests/:id/complete` | 201 `{completion, me}` (new) / 200 (already completed) | 404 |
| `GET /completions` | 200 list, newest first, undone ones excluded | |
| `DELETE /completions/:id` | 204 | 404 unknown or already undone |
| `GET /me` | 200 | |
| `PUT /me` `{timezone}` | 200 | 400 invalid IANA zone |
| `POST /test/reset` | 204, deletes everything | |
