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
| `src/server.ts` | Entry point: runs migrations (dev), creates app, starts HTTP server; handles WebSocket upgrade on `/api/ws` (session auth). |
| `src/app.ts` | Express app: helmet, CORS (origin from `CORS_ORIGIN`, credentials enabled), body limit, cookie parser, `/api` router, static frontend. |
| `src/routes/api.ts` | All API route handlers; uses shared auth middleware; uses services and validation. |
| `src/middleware/auth.ts` | Session and API-key resolution (`resolveAuth`, `resolveApiKeyUser`). |
| `src/mcp/` | MCP Streamable HTTP server at `/mcp`: tools delegate to item and agent-content services. |
| `src/services/` | Business logic: auth, items, notes, API keys, email, rate limiting, OpenClaw device flow, agent content (markdown/form), board broadcast (WebSocket), validation, error helpers. |
| `src/db/prisma.ts` | Prisma client and dev migration runner. |
| `src/domain/types.ts` | Shared enums (urgency, tag, importance, status, actor). |
| `prisma/` | Schema (SQLite for dev, `pg/` for production), migrations. |
| `frontend/src/` | React app: pages, components, API client, hooks. |
| `tests/` | Vitest API tests (Supertest). |
| `skills/clawkpit/` | OpenClaw skill: SKILL.md, api.md, mcp.md for AI agents. |
| `docs/` | Project documentation (this file, etc.). |

## Data model

- **users**: id (UUID), email, name, is_active, created_at, updated_at.
- **items**: id (UUID), human_id (per-user increment), user_id, title, description, urgency, tag, importance, deadline, status (Active/Done/Dropped), created_by, modified_by, has_ai_changes (boolean), content_id (nullable, FK to agent_content), opened_at, created_at, updated_at. Unique (user_id, human_id).
- **notes**: id (UUID), item_id, author (User|AI), content, created_at, updated_at.
- **user_counters**: user_id, next_human_id (for allocating human_id).
- **agent_content**: id (UUID), user_id, type (markdown|form), title, body, external_id, content_hash, created_at, updated_at. Used for agent-pushed markdown and forms; items may link via content_id.
- **form_responses**: id (UUID), user_id, content_id, item_id (nullable), response (JSON), created_at.
- **push_subscriptions**: id (UUID), user_id, endpoint, p256dh, auth, expiration_time, created_at, updated_at. Stores browser push subscriptions per user/device.
- **sessions**, **magic_links**, **api_keys** (hashed), **openclaw_device**, **email_change_requests**: auth and device-flow tables.

Indexes support list queries by (user_id, status, urgency), (user_id, deadline), (user_id, updated_at), and notes by (item_id, created_at). `has_ai_changes` is set when the AI creates or modifies an item (or adds a note); cleared when the user opens the item or makes a change. The UI uses it to show an “AI changed this” indicator.

## MCP (Model Context Protocol)

- **Endpoint:** `POST` and `GET` `/mcp` on the same HTTP server as the API (not a separate deployment).
- **Transport:** Streamable HTTP (stateless; JSON responses). Implemented with `@modelcontextprotocol/server` and `@modelcontextprotocol/node`.
- **Auth:** API key only (`Authorization: Bearer` or `X-API-Key`). Session cookies are rejected to avoid browser CSRF and to match remote agent clients.
- **Tools:** Ten v1 tools (`create_task`, `update_task`, `complete_task`, `list_tasks`, `get_next_action`, `create_reminder`, `create_form_request`, `create_reading_item`, `send_user_message`, `fetch_user_response`) call existing services; `userId` always comes from the key, never from tool arguments.
- **Rate limiting:** Per-user in-memory bucket (`MCP_RATE_LIMIT` / `MCP_RATE_WINDOW_MS`). Audit logs record tool name, user id, and duration (not full payloads).
- **Kill switch:** `MCP_ENABLED=false` returns 503.
- **Host guard (production):** When `APP_BASE_URL` or `MCP_ALLOWED_HOSTS` is configured, `/mcp` rejects requests whose `Host` header does not match (mitigates misrouted or rebinding traffic). Set `MCP_HOST_GUARD=false` to disable, or `MCP_HOST_GUARD=true` to require an allowlist even without `APP_BASE_URL`.

See `skills/clawkpit/mcp.md` for integrator documentation.

## API design

- **REST under `/api`**: Auth under `/api/auth/*`, identity and keys under `/api/me/*`, OpenClaw device under `/api/openclaw/device/*`, items and notes under `/api/v1/items` and `/api/v1/notes`.
- **Validation**: Every request body and query is validated with Zod (schemas in `src/services/validation.ts`). Route params for IDs are validated as UUIDs. Invalid input returns 400 with `error.code` `BAD_REQUEST` and `error.details` (e.g. Zod flatten).
- **Error envelope**: `{ "error": { "code", "message", "details" } }`. Codes: BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, RATE_LIMITED.
- **Ordering**: List items are ordered by deadline ASC (nulls last), importance (High > Medium > Low), updatedAt DESC. Batch endpoint limited to 100 operations per request.

## Auth flow

- **Magic link**: User requests link via `POST /api/auth/request-link` (rate-limited per IP+email). Token is created, stored hashed, and sent by email in production (Resend) or returned in response in dev. User consumes token with `POST /api/auth/consume-link`; server sets session cookie.
- **Session**: Cookie-based; httpOnly, 14-day maxAge. When `CORS_ORIGIN` is set (cross-origin), the session cookie uses `sameSite=none` and `secure=true` in production so the browser sends it on cross-origin requests; otherwise `sameSite=lax` and `secure` only in production. All protected routes resolve user from session or API key.
- **API keys**: Created in Settings; stored hashed. Sent as `Authorization: Bearer <key>` or `X-API-Key`. Used for programmatic and AI access.
- **Actor inference**: If the request does not explicitly send an actor field (`createdBy`, `modifiedBy`, `author`, or `actor`), the server infers it from the auth method: **API key** → `"AI"`, **session** → `"User"`. Callers can still override by sending the field. This keeps `has_ai_changes` and filters correct when the UI or an agent omits the actor.
- **OpenClaw device flow**: `POST /api/openclaw/device/start` (no auth), `POST /api/openclaw/device/poll` (no auth, rate-limited), `POST /api/openclaw/device/confirm` (session required). User enters display code in Clawkpit Settings; agent receives API token via poll and stores it locally.

## Real-time updates (WebSocket)

The HTTP server handles WebSocket upgrades on the same port. Path `/api/ws` is the only upgrade target; others are closed. The client must send the session cookie; the server resolves the user from it and registers the connection in `src/services/boardBroadcast.ts`. After any item mutation (create, update, notes, done, drop, agent markdown/form), the server calls `broadcastToUser(userId, { type: "items:changed" })`. Browser clients (e.g. the board page) subscribe via the `useBoardSocket` hook and refetch the list when they receive the event, so the board updates without a full reload.

Web push is separate from WebSocket sync. The server stores browser subscriptions in `push_subscriptions`, signs payloads with VAPID, and sends a push notification when AI changes an item or adds a note. The service worker shows the notification even if the tab is closed, and only suppresses it when the app is already visibly open.

## Frontend architecture

- **Stack**: React, Vite, TypeScript, Tailwind CSS, Radix UI. SPA with client-side routing.
- **API client**: `frontend/src/api/client.tsx`—fetch wrapper, auth state (user), and API functions for items, notes, auth, keys, OpenClaw.
- **Pages**: Board (urgency/tag views, filters), Login, Signup, Settings (profile, API keys, OpenClaw connect), Archive. Detail panel and modals for item/note editing and done/drop.
- **State**: Auth and board data loaded via API; no global store beyond auth context.

## Where to find what

- **Adding an API endpoint**: Add route in `src/routes/api.ts`, add or reuse schema in `src/services/validation.ts`, implement logic in `src/services/*.ts` (e.g. itemService, authService). Return with `sendApiError` on failure. If the endpoint mutates items (create, update, notes, done, drop, agent content), call `broadcastToUser(userId, { type: "items:changed" })` after the mutation so the board UI updates in real time.
- **Changing the data model**: Edit `prisma/schema.sqlite.prisma` (and `prisma/pg/schema.prisma` if needed), run `npm run db:migrate:dev`, update services and types.
- **Validation rules**: All in `src/services/validation.ts`. Use `uuidParam` for ID params; use existing or new Zod schemas for body/query.
- **Rate limiting**: In-memory in `src/services/rateLimit.ts`; used for magic-link and OpenClaw flows. For multi-instance deployments, consider a shared store (e.g. Redis).
