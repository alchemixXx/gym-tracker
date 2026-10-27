# Connecting an MCP client to Gym Tracker

The Gym Tracker MCP server is a remote **Streamable HTTP** endpoint:

```
https://gym-tracker-nm7e.onrender.com/mcp
```

It authenticates with a personal bearer token. Create one in the app under
**Налаштування → MCP-доступ** ("Create"), copy it (shown once), and paste it
where each client below expects it. The token looks like `gymmcp_…`.

> Security: the token grants full read/write access to your programs and
> templates. Treat any config file that contains it like a password file —
> don't commit it. Prefer the env-var forms shown below. Revoke a leaked token
> from the same Settings screen.

Available tools: `list_programs`, `get_program`, `get_analysis`,
`list_measurements`, `list_templates`, `get_template`, `create_program`,
`update_program`, `create_template`, `update_template`.

---

## Kiro

Kiro supports remote HTTP MCP servers directly with a `url` + `headers`.

Config file: `.kiro/settings/mcp.json` (workspace) or `~/.kiro/settings/mcp.json` (user).

```json
{
  "mcpServers": {
    "gym-tracker": {
      "url": "https://gym-tracker-nm7e.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer gymmcp_YOUR_TOKEN"
      },
      "disabled": false
    }
  }
}
```

Reconnect the server from the MCP panel (or reload the window) after saving.

---

## Cursor

Cursor supports remote servers natively with `url` + `headers`.

Config file: `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global).

```json
{
  "mcpServers": {
    "gym-tracker": {
      "url": "https://gym-tracker-nm7e.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer ${env:GYM_MCP_TOKEN}"
      }
    }
  }
}
```

The `${env:VAR}` form keeps the raw token out of the committed file — set
`GYM_MCP_TOKEN` in your shell environment. Hardcoding the token string also
works but is less safe. Enable the server from **Cursor Settings → MCP** after
saving.

---

## Codex (CLI / IDE / ChatGPT desktop)

Codex supports remote Streamable HTTP servers, but its config is **TOML**, not
JSON, and the token is referenced by an **environment-variable name** rather
than written inline.

Easiest — let the CLI write the config for you:

```bash
codex mcp add gym-tracker \
  --url https://gym-tracker-nm7e.onrender.com/mcp \
  --bearer-token-env-var GYM_MCP_TOKEN
```

Then export the token in the environment Codex runs in:

```bash
export GYM_MCP_TOKEN="gymmcp_YOUR_TOKEN"
```

That writes this into `config.toml` (under `CODEX_HOME`, default `~/.codex/`):

```toml
[mcp_servers.gym-tracker]

[mcp_servers.gym-tracker.transport]
type = "streamable_http"
url = "https://gym-tracker-nm7e.onrender.com/mcp"
bearer_token_env_var = "GYM_MCP_TOKEN"
```

Codex stores only the variable **name**, never the token value — so the config
is safe to keep. Verify with `codex mcp list` (Auth column should read "Bearer
token"), then start a new session and run `/mcp` to confirm the server loaded.
The CLI, IDE extension, and ChatGPT desktop app share this config on the same
machine.

---

## Claude Desktop

Claude Desktop's built-in **Connectors** UI only supports OAuth sign-in — there
is no field for a static bearer token. So bridge through `mcp-remote`, a small
local helper that Claude Desktop launches as a command and that forwards to the
remote URL with the `Authorization` header attached.

Config file (macOS): `~/Library/Application Support/Claude/claude_desktop_config.json`
(open via **Settings → Developer → Edit Config**). Add `mcpServers` as a
top-level key alongside whatever is already in the file.

```json
{
  "mcpServers": {
    "gym-tracker": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://gym-tracker-nm7e.onrender.com/mcp",
        "--header",
        "Authorization:${AUTH_HEADER}"
      ],
      "env": {
        "AUTH_HEADER": "Bearer gymmcp_YOUR_TOKEN"
      }
    }
  }
}
```

Three things that trip people up:

- **`Authorization:` has no space** after the colon, and the token lives in the
  `AUTH_HEADER` env var. This is a documented workaround for an arg-escaping bug
  in how `npx` is invoked with spaces — a space there gets mangled.
- **Use the absolute path to `npx`** if Claude Desktop reports `spawn npx
ENOENT`. Claude launches commands with a minimal PATH that often excludes
  version managers like nvm. Find yours with `which npx` and use that full path
  as `"command"`, e.g. `/Users/you/.nvm/versions/node/vX.Y.Z/bin/npx`.
- **Quit Claude Desktop fully** (Cmd+Q, not just the window) and reopen so it
  reloads the config.

Logs, if something fails: `~/Library/Logs/Claude/mcp-server-gym-tracker.log`.

---

## Quick connectivity check (any client)

Replace the token and run:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://gym-tracker-nm7e.onrender.com/mcp \
  -H 'Authorization: Bearer gymmcp_YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}'
```

`200` = reachable and token valid. `401` = bad/revoked token. First request
after idle may take ~30s while Render cold-starts.
