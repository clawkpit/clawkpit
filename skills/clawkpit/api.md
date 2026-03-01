# Clawkpit API reference

Base URL: use `CLAWKPIT_BASE_URL` from environment or config (e.g. `https://your-clawkpit-instance.example.com` for self-hosted). All paths below are relative to the base (e.g. base + `/api/me`).

## Authentication (items and notes)

- **Header**: `Authorization: Bearer <API_KEY>` or `X-API-Key: <API_KEY>`
- Token is obtained via the **device flow** (`/clawkpit connect`) and stored by the skill, or from env `CLAWKPIT_API_TOKEN` or OpenClaw config `skills.entries.clawkpit.env.CLAWKPIT_API_TOKEN`.
- Never log or echo the token.

**Actor inference:** When using an API key, if you omit `createdBy`, `modifiedBy`, `author`, or `actor` in a request, the server defaults them to `"AI"`. When using a session (browser), they default to `"User"`. You can still send the field explicitly to override.

## Device flow (connect without pasting secrets)

No auth for start and poll; confirm requires a **logged-in session** (cookie).

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/openclaw/device/start` | None | `{ "email": "user@example.com" }` | `{ "display_code": "XXXX-XXXX", "device_code": "<opaque>", "expires_at": "<ISO>" }`. 404 if no account for email. |
| POST | `/api/openclaw/device/confirm` | **Session only** (cookie) | `{ "display_code": "XXXX-XXXX" }` | `{ "ok": true, "message": "OpenClaw connected." }`. 401 if not signed in; 404/400 if invalid or expired code. |
| POST | `/api/openclaw/device/poll` | None | `{ "device_code": "<from start>" }` | `{ "status": "pending" }` or `{ "status": "authorized", "api_token": "<key>" }`. 410 when expired or already consumed. Poll rate-limited per device_code. |

- Codes expire in 10 minutes. Display code is one-time use; after returning `api_token` once, the device is consumed.
- Agent must show only `display_code` and the Clawkpit URL to the user; store `api_token` locally and never print it.

## Identity

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/me` | Returns `{ "user": { "id", "email", "name?" } }`. Requires auth. |

## Items

Enums: **urgency** DoNow | DoToday | DoThisWeek | DoLater | Unclear; **tag** ToRead | ToThinkAbout | ToUse | ToDo; **importance** High | Medium | Low; **status** Active | Done | Dropped; **actor** User | AI.

| Method | Path | Body / Query | Response |
|--------|------|--------------|----------|
| POST | `/api/v1/items` | `title` (required), `description?`, `urgency?`, `tag?`, `importance?`, `deadline?` (ISO or null), `status?`, `createdBy?` | 201 + full item. |
| GET | `/api/v1/items` | Query: `status` (Active\|Done\|Dropped\|All), `tag?`, `importance?`, `urgency?`, `deadlineBefore?`, `deadlineAfter?`, `createdBy?`, `modifiedBy?`, `page`, `pageSize` | `{ "items", "total", "page", "pageSize" }`. |
| GET | `/api/v1/items/:id` | — | Single item or 404. |
| PATCH | `/api/v1/items/:id` | Any of: `title`, `description`, `urgency`, `tag`, `importance`, `deadline`, `status`, `openedAt`, `modifiedBy`, `hasAIChanges` | Updated item or 404. |
| POST | `/api/v1/items/batch` | Array of `{ "action": "create" \| "update", "id?" (for update), "payload" }` | `{ "results": [ { "ok", "item?" \| "error?" } ] }`. |

## Notes

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/v1/items/:id/notes` | `{ "author": "User" \| "AI", "content": "..." }` | 201 + note. |
| GET | `/api/v1/items/:id/notes` | — | Array of notes. |
| PATCH | `/api/v1/notes/:noteId` | `{ "actor", "content" }` | **User only.** AI gets 403. Updated note or 404. |

## Item actions

| Method | Path | Body | Notes |
|--------|------|------|--------|
| POST | `/api/v1/items/:id/done` | `{ "actor": "User" \| "AI" }` | ToThinkAbout items require at least one note before marking done. |
| POST | `/api/v1/items/:id/drop` | `{ "actor", "note?" }` | Item must have at least one note (add one if needed). |

## Agent content push

Push markdown or form content to a user's board. Uses upsert semantics: if `externalId` matches an existing record (or `contentHash` matches when no `externalId`), the content is updated and the existing item is returned.

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/agent/markdown` | `{ "title?", "markdown" (required, max 100k), "externalId?" }` | 201 + `{ "markdownId", "itemId" }`. Creates a ToRead item linked to the content. |
| GET | `/api/markdown/:id` | — | `{ "id", "title", "markdown", "createdAt" }` or 404. Only the owning user can access. |
| POST | `/api/agent/form` | `{ "title?", "formMarkdown" (required, max 100k), "externalId?" }` | 201 + `{ "formId", "itemId" }`. Creates a ToDo item linked to the form. |
| GET | `/api/forms/:id` | — | `{ "id", "title", "formMarkdown", "createdAt" }` or 404. Only the owning user can access. |
| POST | `/api/forms/:id/submit` | `{ "itemId?", "response": { ... } }` | 201 + `{ "id" }`. Saves the response and marks the linked item as Done. |
| GET | `/api/agent/forms/:id/responses` | — | `{ "responses": [ ... ] }`. Only the owning user can access. |

## Real-time updates (WebSocket)

Browser clients can connect to `ws(s)://<host>/api/ws` (session cookie required). The server sends `{ "type": "items:changed" }` after every item mutation (create, update, notes, done, drop, agent push). No messages are expected from the client. The connection is per-user; only events for the authenticated user's board are delivered.

## Item shape

`id`, `humanId`, `userId`, `title`, `description`, `urgency`, `tag`, `importance`, `deadline` (ISO or null), `status`, `createdAt`, `updatedAt`, `openedAt`, `createdBy`, `modifiedBy`, `hasAIChanges` (boolean), `contentId?`, `contentType?`.

## Note shape

`noteId`, `itemId`, `author`, `content`, `createdAt`, `updatedAt`.

## Error responses

Standard envelope: `{ "error": { "code", "message", "details" } }`. Codes include BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, RATE_LIMITED, INTERNAL_ERROR.
