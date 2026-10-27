-- Per-user MCP access tokens.
-- Each token lets an external MCP client (Claude Desktop, Kiro, etc.) act as
-- one specific user. Only the SHA-256 hash of the token is stored; the raw
-- value is shown to the user exactly once at creation time.
CREATE TABLE IF NOT EXISTS mcp_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE, -- sha256 hex of the raw token
  label VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_hash ON mcp_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user_id ON mcp_tokens(user_id);
