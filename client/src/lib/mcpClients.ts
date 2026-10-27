/**
 * MCP client setup definitions for the Settings UI.
 *
 * Each entry describes how to connect one LLM client to the gym-tracker MCP
 * server, with a config snippet template that gets the live token + URL
 * injected at render time. Kept here (not in the component) so the snippets are
 * easy to maintain and the view stays readable.
 */

export interface McpClientStep {
  /** Optional language label shown above a code block (e.g. "mcp.json", "bash"). */
  file?: string;
  /** Prose shown before the code block. */
  text?: string;
  /** Code snippet (token/url already interpolated). */
  code?: string;
}

export interface McpClientGuide {
  id: string;
  name: string;
  /** One-line summary of the connection approach. */
  summary: string;
  steps: McpClientStep[];
  /** Short gotchas / notes shown under the steps. */
  notes?: string[];
}

export interface McpSnippetContext {
  url: string;
  token: string;
}

/**
 * Build the per-client guides with the live URL and token interpolated.
 * `token` may be a placeholder (e.g. for an already-saved token where the raw
 * value is no longer known) — callers decide what to pass.
 */
export function buildMcpGuides(ctx: McpSnippetContext): McpClientGuide[] {
  const { url, token } = ctx;

  return [
    {
      id: 'kiro',
      name: 'Kiro',
      summary: 'Пряма підтримка віддаленого HTTP: URL + заголовок.',
      steps: [
        {
          text: 'Додайте до .kiro/settings/mcp.json (проєкт) або ~/.kiro/settings/mcp.json (глобально):',
          file: 'mcp.json',
          code: `{
  "mcpServers": {
    "gym-tracker": {
      "url": "${url}",
      "headers": {
        "Authorization": "Bearer ${token}"
      },
      "disabled": false
    }
  }
}`,
        },
      ],
      notes: [
        'Після збереження перепідключіть сервер у панелі MCP або перезавантажте вікно.',
      ],
    },
    {
      id: 'cursor',
      name: 'Cursor',
      summary: 'Нативна підтримка віддаленого HTTP: URL + заголовок.',
      steps: [
        {
          text: 'Додайте до .cursor/mcp.json (проєкт) або ~/.cursor/mcp.json (глобально):',
          file: 'mcp.json',
          code: `{
  "mcpServers": {
    "gym-tracker": {
      "url": "${url}",
      "headers": {
        "Authorization": "Bearer ${token}"
      }
    }
  }
}`,
        },
      ],
      notes: [
        'Увімкніть сервер у Cursor Settings → MCP після збереження.',
        'Щоб не тримати токен у файлі відкрито, можна використати "Bearer ${env:GYM_MCP_TOKEN}" і задати змінну середовища.',
      ],
    },
    {
      id: 'codex',
      name: 'Codex',
      summary: 'Теж нативно, але конфіг у TOML; токен — через env-змінну.',
      steps: [
        {
          text: '1. Додайте сервер командою (запише конфіг за вас):',
          file: 'bash',
          code: `codex mcp add gym-tracker \\
  --url ${url} \\
  --bearer-token-env-var GYM_MCP_TOKEN`,
        },
        {
          text: '2. Експортуйте токен у середовищі, де працює Codex:',
          file: 'bash',
          code: `export GYM_MCP_TOKEN="${token}"`,
        },
        {
          text: 'Це запише у config.toml (під CODEX_HOME, типово ~/.codex/):',
          file: 'config.toml',
          code: `[mcp_servers.gym-tracker]

[mcp_servers.gym-tracker.transport]
type = "streamable_http"
url = "${url}"
bearer_token_env_var = "GYM_MCP_TOKEN"`,
        },
      ],
      notes: [
        'Codex зберігає лише НАЗВУ змінної, а не сам токен — тому config.toml безпечно тримати.',
        'Перевірте: codex mcp list (колонка Auth = "Bearer token"), потім /mcp у новій сесії.',
      ],
    },
    {
      id: 'claude',
      name: 'Claude Desktop',
      summary: 'UI конекторів — лише OAuth, тому підключення через міст mcp-remote.',
      steps: [
        {
          text: 'Відкрийте Settings → Developer → Edit Config і додайте ключ "mcpServers" поряд із наявним вмістом (~/Library/Application Support/Claude/claude_desktop_config.json на macOS):',
          file: 'claude_desktop_config.json',
          code: `{
  "mcpServers": {
    "gym-tracker": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${url}",
        "--header",
        "Authorization:\${AUTH_HEADER}"
      ],
      "env": {
        "AUTH_HEADER": "Bearer ${token}"
      }
    }
  }
}`,
        },
      ],
      notes: [
        '"Authorization:" без пробілу після двокрапки, а токен — в env AUTH_HEADER: це обхід бага екранування у npx.',
        'Якщо "spawn npx ENOENT" — замініть "npx" на абсолютний шлях (which npx), напр. /Users/you/.nvm/versions/node/vX/bin/npx.',
        'Повністю вийдіть із Claude (Cmd+Q), не лише закрийте вікно, і відкрийте знову.',
      ],
    },
  ];
}
