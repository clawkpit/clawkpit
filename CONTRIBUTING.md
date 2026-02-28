# Contributing to Clawkpit

Thanks for your interest in contributing. This document covers how to get set up, our conventions, and how to submit changes.

## Development setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   npm run db:generate:dev
   npm run db:migrate:dev
   ```

2. Start the app:

   ```bash
   npm run dev
   ```

   The API runs on port 3000; the frontend (Vite) runs on port 5173. Open `http://localhost:5173`.

3. (Optional) Copy `.env.example` to `.env` and adjust if you need production-like options (e.g. Resend for email). Development works without `.env` (SQLite, magic-link token returned in API response).

## Running tests

- **API tests** (Vitest + Supertest):

  ```bash
  npm test
  ```

- **Build** (ensures TypeScript and frontend build succeed):

  ```bash
  npm run build
  npm run build:frontend
  ```

Please ensure tests pass and the project builds before submitting a PR.

## Code style and conventions

- **TypeScript**: Strict mode. Prefer explicit types for public APIs and complex return shapes.
- **Validation**: All API request inputs (body, query, route params) are validated with [Zod](https://zod.dev). Add or extend schemas in `src/services/validation.ts` and use `.safeParse()` in route handlers. Return `sendApiError(res, 400, ...)` with `parsed.error.flatten()` on validation failure.
- **Database**: Use Prisma only; no raw SQL in application code. Queries are scoped by `userId` for user data. Run migrations via `npm run db:migrate:dev` (dev) or `npm run db:migrate:deploy` (production schema).
- **Errors**: Use the shared `sendApiError` helper and `ApiErrorCode` for consistent error responses (see `src/services/apiError.ts`).
- **Formatting**: Keep existing style (indentation, quotes). You can use the project’s formatter/linter if configured.

## Where to find things

| Area | Location |
|------|----------|
| API routes | `src/routes/api.ts` |
| Request validation | `src/services/validation.ts` |
| Business logic (auth, items, keys, etc.) | `src/services/*.ts` |
| Database client and migrations | `src/db/prisma.ts`, `prisma/` |
| Frontend app and pages | `frontend/src/` |
| API tests | `tests/api.test.ts` |
| OpenClaw skill docs | `skills/clawkpit/` |

See also [docs/architecture.md](docs/architecture.md) for a higher-level overview.

## Submitting changes

1. Open an issue or comment on an existing one to discuss larger changes.
2. Branch from the default branch, make focused commits, and add or update tests as needed.
3. Open a pull request with a clear description of what changed and why. Link any related issues.
4. Wait for review. Address feedback and keep the PR up to date with the base branch.

There is no formal commit message format; clear, short messages are preferred.

## Code of conduct

By participating in this project, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).
