# Clawkpit

**The Cockpit for your Claw.**

Use it at **[clawkpit.com](https://clawkpit.com)** if you don’t want to self-host, or run your own instance below.

Clawkpit is an AI-managed Kanban board: urgency-driven columns (Do Now, Do Today, Do This Week, Do Later, Unclear), single tag per item (To Read, To Think About, To Use, To Do), notes, and done/drop rules. It’s designed **local-first** and **privacy-friendly**—self-host or run a single instance; magic-link auth and API keys; no passwords. Your AI agent (e.g. OpenClaw) can manage tasks via the API while you stay in control in the web UI.

## Quick start

```bash
npm install
npm run db:generate:dev
npm run db:migrate:dev
npm run dev
```

Open **http://localhost:5173**. In development, the API returns the magic-link token in the response so you can paste it into the login form without email.

## Architecture overview

- **Backend**: Express (Node.js), TypeScript, Prisma ORM. REST API under `/api`; all request data validated with Zod.
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Radix UI. SPA that talks to the same origin API.
- **Database**: SQLite in development (`data/mico.sqlite`); PostgreSQL in production via `DATABASE_URL`.
- **Auth**: Magic-link email (Resend in production), session cookies, API keys (Bearer or `X-API-Key`). OpenClaw device flow for connecting agents without pasting secrets.
- **Where things live**: API routes in `src/routes/api.ts`, validation in `src/services/validation.ts`, business logic in `src/services/*.ts`, DB in `src/db/prisma.ts` and `prisma/`. Frontend in `frontend/src/`. OpenClaw skill docs in `skills/clawkpit/`.

See [docs/architecture.md](docs/architecture.md) for a fuller picture (data model, API design, auth flow).

## Configuration reference

Copy `.env.example` to `.env` and set values as needed.

| Variable | Required | Default | Description |
|----------|----------|--------|-------------|
| `PORT` | No | `3000` | Server port. |
| `TRUST_PROXY` | No | unset | Set to `1` or `true` when behind a reverse proxy so rate limiting uses the correct client IP. |
| `CORS_ORIGIN` | No | same-origin | Comma-separated origins allowed for cross-origin API requests (e.g. a landing site on another domain). When set, the app enables CORS credentials and uses `SameSite=None` for the session cookie in production so logged-in state can be checked from the other origin. |
| `DATABASE_URL` | Production | — | PostgreSQL URL. Not used in development (SQLite). |
| `RESEND_API_KEY` | Production (email) | — | Resend API key for magic-link emails. |
| `APP_BASE_URL` | Production (email) | — | Base URL of the app (e.g. for magic-link links). |
| `MAGIC_LINK_FROM_EMAIL` | No | `Clawkpit <onboarding@resend.dev>` | Sender address for magic-link emails. |
| `VITE_APP_URL` | No | `window.location.origin` | Public URL shown in frontend (e.g. OpenClaw install command in Settings). Set at build time. |

## Database (Prisma)

- **Development:** SQLite at `data/mico.sqlite`. Run `npm run db:generate:dev` and `npm run db:migrate:dev` when you change the schema; the app runs migrations on startup in dev.
- **Production:** Set `DATABASE_URL` to your PostgreSQL instance. Run `npm run db:generate:prod` in your build pipeline and `npm run db:migrate:deploy` against the production DB before or after deploy (e.g. in your platform’s start or release command).

## Production deployment

- Build: `npm run build` and `npm run build:frontend` (or your CI equivalent). Start with `npm start` (serves API and frontend from the same process).
- Put the app behind HTTPS and a reverse proxy. Set `TRUST_PROXY=1` if you need correct client IPs for rate limiting. Set `CORS_ORIGIN` to the other origin(s) (e.g. `https://clawkpit.com`) if a separate site (e.g. landing page) needs to call the API with credentials to check login state.
- For magic-link email in production, set `RESEND_API_KEY`, `APP_BASE_URL`, and optionally `MAGIC_LINK_FROM_EMAIL` (see [Resend](https://resend.com)). Without these, the request-link endpoint still responds but does not send email.

## API overview

- **Auth:** `POST /api/auth/request-link`, `POST /api/auth/consume-link`, `POST /api/auth/logout`
- **Identity:** `GET /api/me`, `PATCH /api/me`
- **API keys:** `GET /api/me/keys`, `POST /api/me/keys`, `DELETE /api/me/keys/:id`
- **Items:** `GET /api/v1/items`, `POST /api/v1/items`, `GET /api/v1/items/:id`, `PATCH /api/v1/items/:id`, `POST /api/v1/items/batch`
- **Actions:** `POST /api/v1/items/:id/done`, `POST /api/v1/items/:id/drop`
- **Notes:** `POST /api/v1/items/:id/notes`, `GET /api/v1/items/:id/notes`, `PATCH /api/v1/notes/:noteId`
- **Agent content:** `POST /api/agent/markdown`, `POST /api/agent/form`, `GET /api/markdown/:id`, `GET /api/forms/:id`, `POST /api/forms/:id/submit`
- **Real-time:** WebSocket at `ws(s)://<host>/api/ws` (session cookie required); server pushes `items:changed` after mutations.

Error responses use a unified envelope: `{ "error": { "code", "message", "details" } }`. Codes include `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`. Validation errors appear in `details`. See `skills/clawkpit/api.md` for a concise API reference (device flow, enums, shapes, actor inference).

## Tests and build

```bash
npm test
npm run build
```

## For AI agents and code navigation

- **Philosophy**: Single-user or single-tenant; urgency- and tag-driven Kanban; AI can create/update items and add notes via API; users approve done/drop and can edit notes. All inputs validated with Zod; IDs are UUIDs.
- **Entrypoints**: Backend entry is `src/server.ts` → `src/app.ts` (Express) and `src/routes/api.ts` (routes). Frontend entry is `frontend/src/main.tsx` and `frontend/src/App.tsx`.
- **Validation**: All API request bodies and query params are validated in `src/services/validation.ts` (Zod schemas). Route params (`:id`, `:noteId`) are validated as UUIDs in the route handlers.
- **Data access**: Prisma client in `src/db/prisma.ts`. All item/note access is scoped by authenticated user (session or API key). Services in `src/services/` perform DB operations.

## Contributing, license, security

- [CONTRIBUTING.md](CONTRIBUTING.md) — Setup, code style, where to find things, how to submit changes.
- [LICENSE](LICENSE) — MIT.
- [SECURITY.md](SECURITY.md) — How to report vulnerabilities and the project’s threat model (local-first).
