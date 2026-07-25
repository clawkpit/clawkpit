# Clawkpit API reference

**Integration order:** Prefer the [CLI](cli.md) when available, then [MCP](mcp.md) for MCP-capable agents, then this REST API. This REST reference remains the source of truth for harness slash commands (e.g. OpenClaw `/clawkpit`) and fallback integrations.

Base URL: use `CLAWKPIT_BASE_URL` from environment or config (e.g. `https://your-clawkpit-instance.example.com` for self-hosted; hosted API: `https://app.clawkpit.com`). All paths below are relative to the base (e.g. base + `/api/me`).

## Authentication (items and notes)

- **Header**: `Authorization: Bearer <API_KEY>` or `X-API-Key: <API_KEY>`
- Token is obtained via the **device flow** (`/clawkpit connect`) and stored by the skill, or from env `CLAWKPIT_API_TOKEN` or harness config (e.g. OpenClaw `skills.entries.clawkpit.env.CLAWKPIT_API_TOKEN`).
- Never log or echo the token.

**Agent actor rule:** Agents should act as `AI`, not `User`. When using an API key, if you omit `createdBy`, `modifiedBy`, `author`, or `actor`, the server defaults them to `"AI"`. Agents may send `"AI"` explicitly, but should not send `"User"`.

**Assignee rule:** `assignedTo` is who should perform the next action (`User` = human, `AI` = agent). On item create via API key, `assignedTo` is **required**. On session/user create, it defaults to `"AI"` if omitted. Agent markdown/form push creates items with `assignedTo: "User"`. Use `assignedTo=User` for the human inbox/focus; use `assignedTo=AI` for the agent queue/work.

## Device flow (connect without pasting secrets)

`POST /api/openclaw/device/start` is the only request needed to generate the display code. Return it to the user immediately; do not wait for authorization before showing the code. Polling is separate and can continue in the background after the code is already surfaced.

No auth for start and poll; confirm requires a **logged-in session** (cookie) whose email matches the email used at start.

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/openclaw/device/start` | None | `{ "email": "user@example.com" }` | `{ "display_code": "XXXX-XXXX", "device_code": "<opaque>", "expires_at": "<ISO>" }`. 404 if no account for email. |
| POST | `/api/openclaw/device/confirm` | **Session only** (cookie) | `{ "display_code": "XXXX-XXXX" }` | `{ "ok": true, "message": "Agent connected." }`. 401 if not signed in; 403 if signed-in email does not match the code; 404/400 if invalid or expired code. |
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
| POST | `/api/v1/items` | `title` (required), `description?`, `urgency?`, `tag?`, `importance?`, `deadline?` (ISO or null), `status?`, `createdBy?`, `assignedTo?` (required for API-key auth; defaults to `AI` for session) | 201 + full item. |
| GET | `/api/v1/items` | Query: `status` (Active\|Done\|Dropped\|All), `tag?`, `importance?`, `urgency?`, `deadlineBefore?`, `deadlineAfter?`, `createdBy?`, `modifiedBy?`, `assignedTo?`, `page`, `pageSize` | `{ "items", "total", "page", "pageSize" }`. |
| GET | `/api/v1/items/:id` | — | Single item or 404. |
| PATCH | `/api/v1/items/:id` | Any of: `title`, `description`, `urgency`, `tag`, `importance`, `deadline`, `status`, `openedAt`, `modifiedBy`, `assignedTo`, `hasAIChanges` | Updated item or 404. |
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

Use `externalId` for recurring syncs from external systems. It should be a deterministic, source-based identifier for the logical record, not a hash of the current body and not a mutable title. Good patterns include `gmail:thread:<id>`, `calendar:event:<id>`, `notion:page:<id>`, and `github:issue:<repo>:<number>`. Reuse the same `externalId` whenever that same source record is updated. Omit it for one-off pushes where content-hash deduplication is acceptable.

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/agent/markdown` | `{ "title?", "markdown" (required, max 100k), "externalId?" }` | 201 + `{ "markdownId", "itemId", "action" }`. Creates or updates a ToRead item linked to the content (`assignedTo: User`). |
| GET | `/api/markdown/:id` | — | `{ "id", "title", "markdown", "createdAt" }` or 404. Only the owning user can access. |
| POST | `/api/agent/form` | `{ "title?", "formMarkdown" (required, max 100k), "externalId?" }` | 201 + `{ "formId", "itemId", "action" }`. Creates or updates a ToDo item linked to the form (`assignedTo: User`). |
| GET | `/api/forms/:id` | — | `{ "id", "title", "formMarkdown", "createdAt" }` or 404. Only the owning user can access. |
| POST | `/api/forms/:id/submit` | `{ "itemId?", "response": { ... } }` | 201 + `{ "id" }`. Saves the response and marks the linked item as Done. Intended for human-completed forms, not agent-authored submissions. |
| GET | `/api/agent/forms/:id/responses` | — | `{ "responses": [ { "id", "userId", "contentId", "itemId", "response", "createdAt" } ] }`. Only the owning user can access. |

## Push notifications

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/push/public-key` | — | `{ "publicKey": "..." \| null, "configured": true\|false }`. Requires auth. |
| POST | `/api/push/subscribe` | A PushSubscription JSON object (`endpoint`, `expirationTime?`, `keys.p256dh`, `keys.auth`) | 201 + `{ "ok": true }`. Saves or updates the browser subscription for the current user. |
| POST | `/api/push/unsubscribe` | `{ "endpoint": "..." }` | `{ "ok": true, "removed": true\|false }`. Removes the current user's subscription for that endpoint. |


## Real-time updates (WebSocket)

Browser clients can connect to `ws(s)://<host>/api/ws` (session cookie required). The server sends `{ "type": "items:changed" }` after every item mutation (create, update, notes, done, drop, agent push). No messages are expected from the client. The connection is per-user; only events for the authenticated user's board are delivered.

## Item shape

`id`, `humanId`, `userId`, `title`, `description`, `urgency`, `tag`, `importance`, `deadline` (ISO or null), `status`, `createdAt`, `updatedAt`, `openedAt`, `createdBy`, `modifiedBy`, `assignedTo` (User \| AI), `hasAIChanges` (boolean), `contentId?` (linked agent content UUID or null), `contentType?` ("markdown" \| "form" \| null).

## Note shape

`noteId`, `itemId`, `author`, `content`, `createdAt`, `updatedAt`.

## Error responses

Standard envelope: `{ "error": { "code", "message", "details" } }`. Codes include BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, RATE_LIMITED, INTERNAL_ERROR.
