# Habit Tracker

A habit tracker application with a Fastify + TypeScript + SQLite API and a Next.js frontend.

## Project structure

```text
habit-tracker/
├── api/                    # Fastify API
│   ├── src/                # API, business rules, database and validation
│   ├── tests/              # Unit, API and replay tests
│   ├── scripts/            # Recording replay script
│   ├── Dockerfile
│   └── package.json
├── ui/                     # Next.js frontend
│   ├── app/                # Next.js pages and layout
│   ├── components/         # UI components
│   ├── lib/                # API client
│   ├── Dockerfile
│   ├── package.json
│   └── pnpm-lock.yaml
├── package.json            # Root package for running both apps concurrently
├── docker-compose.yml
└── README.md
```

## Run the application

### With Docker Compose (recommended)

Requirements: Docker Engine and Docker Compose.

From the project root, run:

```bash
docker compose up --build
```

The command builds and starts both the API and frontend.

- **Frontend:** http://localhost:3000
- **API:** http://localhost:3001
- **API user endpoint:** http://localhost:3001/me

The SQLite database is stored in the `api-data` named volume. Data survives container restarts and `docker compose down`.

To stop the application, press `Ctrl+C` and run:

```bash
docker compose down
```

To remove the database volume and all stored data as well:

```bash
docker compose down -v
```

### Without Docker

Requirements:
- Node.js 22.13 or newer
- npm
- pnpm for the frontend

From the project root, install dependencies and start both the API and the UI concurrently:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The API listens on port `3001`; the frontend listens on port `3000`.

## Configuration

### API

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `HOST` | `0.0.0.0` | Network interface |
| `DATABASE_PATH` | `data/habit-tracker.db` | SQLite database file |

In Docker, the database path is `/data/habit-tracker.db`.

### Frontend

The Next.js configuration uses `API_URL` to forward `/api/*` requests to the backend.

- Local development defaults to `http://localhost:3001`.
- Docker Compose uses `http://api:3001` for communication between containers.

## Evidence it works & Tests

### Replay against a running API

The implementation strictly follows the reference recording. Running the replay script against the API yields a 100% match:

```bash
$ cd api
$ npm run replay
68/68 requests match the recording
```

**Warning:** replaying the recording resets the database. Do not run it against data you want to keep.

### API tests

From the project root:

```bash
cd api
npm test
npm run typecheck
npm run build
```

The test suite covers unit tests, API tests and replay tests using `tests/fixtures/reference_recording.jsonl`.

### Frontend checks

From the project root:

```bash
cd ui
pnpm typecheck
pnpm build
```

## API

Errors use the following format:

```json
{"error": "<message>"}
```

Any request may include an `X-Now` header containing an ISO 8601 timestamp with an offset to override the current time.

| Method | Path | Success |
|---|---|---|
| `POST` | `/quests` | `201` — created quest |
| `GET` | `/quests` | `200` — quests, newest first |
| `POST` | `/quests/:id/complete` | `201` for a new completion, `200` if already completed |
| `GET` | `/completions` | `200` — active completions, newest first |
| `DELETE` | `/completions/:id` | `204` — completion undone |
| `GET` | `/me` | `200` — user progress |
| `PUT` | `/me` | `200` — updated timezone |
| `POST` | `/test/reset` | `204` — reset all data |

Invalid input returns `400`; unknown quests or completions return `404`, as applicable.

## Documentation

- `docs/RULES.md` — rules inferred from the reference recording, with line numbers.
- `docs/DECISIONS.md` — implementation decisions, unresolved ambiguities, weak points, AI usage notes, and outside observations.