# clawkpit CLI

JSON-only CLI for AI agents (Hermes, OpenClaw, etc.) — a lower-token alternative to the Clawkpit MCP server. Talks to the REST API.

## Install

```bash
# from this repo
npm install --prefix cli
npm run build --prefix cli
npm link --prefix cli   # optional: puts `clawkpit` on PATH

# or run without linking
node cli/dist/index.js --help
npx tsx cli/src/index.ts --help
```

When published to npm:

```bash
npm install -g clawkpit
# or
npx clawkpit --help
```

## Auth

```bash
export CLAWKPIT_BASE_URL=https://app.clawkpit.com   # optional; this is the default
clawkpit connect user@example.com
clawkpit status
clawkpit logout
```

Token resolution order: `CLAWKPIT_API_TOKEN` (or `CLAWKPIT_API_KEY`) → `~/.config/clawkpit/config.json`.

`connect` prints a pending JSON object with `display_code` immediately, polls until authorized, then prints a final authorized JSON object. The API token is stored locally and never printed.

## Commands (MCP parity)

| CLI | MCP tool |
|-----|----------|
| `create-task` | `create_task` |
| `update-task` | `update_task` |
| `complete-task` | `complete_task` |
| `list-tasks` | `list_tasks` |
| `get-next-action` | `get_next_action` |
| `create-reminder` | `create_reminder` |
| `create-form-request` | `create_form_request` |
| `create-reading-item` | `create_reading_item` |
| `send-user-message` | `send_user_message` |
| `fetch-user-response` | `fetch_user_response` |

Snake_case aliases work (`create_task`, …). Pass fields as kebab-case flags or `--json '{"assigned_to":"AI",...}'` using MCP snake_case names.

Examples:

```bash
clawkpit create-task --title "Ship CLI" --assigned-to AI --tag ToDo --urgency DoToday
clawkpit list-tasks --assigned-to User --status Active
clawkpit get-next-action --assignee AI --include-notes
clawkpit complete-task --item-id <uuid>
clawkpit create-reading-item --title "Brief" --markdown "# Hello"
clawkpit create-form-request --form-markdown-file ./form.md
```

All output is a single JSON object per response (`ok: true|false`). Exit code `0` on success, non-zero on failure.
