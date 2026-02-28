# Clawkpit architecture

This document describes the architecture, data model, and design decisions of Clawkpit for contributors and integrators.

## Philosophy

Clawkpit is a **single-user or single-tenant**, **AI-managed Kanban board**:

- **Urgency-driven**: Five active columns—Do Now, Do Today, Do This Week, Do Later, Unclear. Items are ordered by deadline (ASC, nulls last), importance (High / Medium / Low), and last updated.
- **Tag and guardrails**: One tag per item (To Read, To Think About, To Use, To Do). ToThinkAbout items require at least one note before marking Done. Dropping an item requires at least one note (existing or in the request).
- **AI and user roles**: The AI (or any API client) can create/update items and add notes. Only the user can edit existing notes. Done/drop actions require an explicit actor (User or AI).
- **Local-first**: Designed for self-hosted or single-instance deployment. Data is scoped by authenticated user; no multi-tenant sharing in the app itself.

## Directory structure

| Path | Purpose |
|------|--------|
| `src/` | Backend: Express app, API routes, services, DB client. |
| `src/server.ts` | Entry point: runs migrations (dev), creates app, starts HTTP server. |
| `src/app.ts` | Express app: helmet, CORS (origin from `CORS_ORIGIN`, credentials enabled), body limit, cookie parser, `/api` router, static frontend. |
| `src/routes/api.ts` | All API route handlers; auth middleware; uses services and validation. |
| `src/services/` | Business logic: auth, items, notes, API keys, email, rate limiting, OpenClaw device flow, validation, error helpers. |
| `src/db/prisma.ts` | Prisma client and dev migration runner. |
| `src/domain/types.ts` | Shared enums (urgency, tag, importance, status, actor). |
| `prisma/` | Schema (SQLite for dev, `pg/` for production), migrations. |
| `frontend/src/` | React app: pages, components, API client, hooks. |
| `tests/` | Vitest API tests (Supertest). |
| `skills/clawkpit/` | OpenClaw skill: SKILL.md, api.md, README for AI agents. |
| `docs/` | Project documentation (this file, etc.). |

## Data model

- **users**: id (UUID), email, name, is_active, created_at, updated_at.
- **items**: id (UUID), human_id (per-user increment), user_id, title, description, urgency, tag, importance, deadline, status (Active/Done/Dropped), created_by, modified_by, opened_at, created_at, updated_at. Unique (user_id, human_id).
- **notes**: id (UUID), item_id, author (User|AI), content, created_at, updated_at.
- **user_counters**: user_id, next_human_id (for allocating human_id).
- **sessions**, **magic_links**, **api_keys** (hashed), **openclaw_device**, **email_change_requests**: auth and device-flow tables.

Indexes support list queries by (user_id, status, urgency), (user_id, deadline), (user_id, updated_at), and notes by (item_id, created_at).

## API design

- **REST under `/api`**: Auth under `/api/auth/*`, identity and keys under `/api/me/*`, OpenClaw device under `/api/openclaw/device/*`, items and notes under `/api/v1/items` and `/api/v1/notes`.
- **Validation**: Every request body and query is validated with Zod (schemas in `src/services/validation.ts`). Route params for IDs are validated as UUIDs. Invalid input returns 400 with `error.code` `BAD_REQUEST` and `error.details` (e.g. Zod flatten).
- **Error envelope**: `{ "error": { "code", "message", "details" } }`. Codes: BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, RATE_LIMITED.
- **Ordering**: List items are ordered by deadline ASC (nulls last), importance (High > Medium > Low), updatedAt DESC. Batch endpoint limited to 100 operations per request.

## Auth flow

- **Magic link**: User requests link via `POST /api/auth/request-link` (rate-limited per IP+email). Token is created, stored hashed, and sent by email in production (Resend) or returned in response in dev. User consumes token with `POST /api/auth/consume-link`; server sets session cookie.
- **Session**: Cookie-based; httpOnly, 14-day maxAge. When `CORS_ORIGIN` is set (cross-origin), the session cookie uses `sameSite=none` and `secure=true` in production so the browser sends it on cross-origin requests; otherwise `sameSite=lax` and `secure` only in production. All protected routes resolve user from session or API key.
- **API keys**: Created in Settings; stored hashed. Sent as `Authorization: Bearer <key>` or `X-API-Key`. Used for programmatic and AI access.
- **OpenClaw device flow**: `POST /api/openclaw/device/start` (no auth), `POST /api/openclaw/device/poll` (no auth, rate-limited), `POST /api/openclaw/device/confirm` (session required). User enters display code in Clawkpit Settings; agent receives API token via poll and stores it locally.

## Frontend architecture

- **Stack**: React, Vite, TypeScript, Tailwind CSS, Radix UI. SPA with client-side routing.
- **API client**: `frontend/src/api/client.tsx`—fetch wrapper, auth state (user), and API functions for items, notes, auth, keys, OpenClaw.
- **Pages**: Board (urgency/tag views, filters), Login, Signup, Settings (profile, API keys, OpenClaw connect), Archive. Detail panel and modals for item/note editing and done/drop.
- **State**: Auth and board data loaded via API; no global store beyond auth context.

## Where to find what

- **Adding an API endpoint**: Add route in `src/routes/api.ts`, add or reuse schema in `src/services/validation.ts`, implement logic in `src/services/*.ts` (e.g. itemService, authService). Return with `sendApiError` on failure.
- **Changing the data model**: Edit `prisma/schema.sqlite.prisma` (and `prisma/pg/schema.prisma` if needed), run `npm run db:migrate:dev`, update services and types.
- **Validation rules**: All in `src/services/validation.ts`. Use `uuidParam` for ID params; use existing or new Zod schemas for body/query.
- **Rate limiting**: In-memory in `src/services/rateLimit.ts`; used for magic-link and OpenClaw flows. For multi-instance deployments, consider a shared store (e.g. Redis).
