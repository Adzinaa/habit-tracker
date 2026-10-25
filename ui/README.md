# Questly Habit Tracker UI

Next.js App Router frontend for the single-user Fastify habit-tracker API.

## Requirements

- Node.js 22.13 or newer
- The API running on `http://localhost:3001`

The API source, tests, and Docker Compose files described by the supplied backend documentation are not present in this checkout. They must be restored before backend tests, the reference replay, or the full Docker setup can run.

## Local development

```bash
pnpm install
pnpm dev
```

The UI runs on <http://localhost:3000>. Next.js rewrites `/api/*` to `http://localhost:3001/*`, avoiding a cross-origin browser request.

To use a different server-side API address:

```bash
API_URL=http://localhost:3001 pnpm dev
```

`NEXT_PUBLIC_API_URL` is also supported for a browser-accessible API origin, but the same-origin rewrite is preferred.

## Checks

```bash
pnpm typecheck
pnpm build
```

When the backend is restored, also run its documented checks:

```bash
cd api
npm test
npm run typecheck
npm run replay -- http://localhost:3001
```

The supplied reference recording expects `68/68 requests match the recording`.

## Docker status

No `api/` directory, API Dockerfile, or Compose file exists in this repository, so a truthful working `docker compose up` configuration cannot be added from this checkout alone. The documented target remains UI on port 3000, API on port 3001, and a persistent `api-data` volume for SQLite.
