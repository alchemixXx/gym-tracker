import { Router, type Request, type Response } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { createHash } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildMcpServer } from './server.js';
import { pool } from '../db/pool.js';

/**
 * Express router that exposes the gym-tracker MCP server over Streamable HTTP
 * at POST/GET/DELETE /mcp, mounted on the main app.
 *
 * Auth (two mechanisms, checked in order):
 *   1. Per-user DB tokens (mcp_tokens): the bearer token is SHA-256 hashed and
 *      looked up; a non-revoked match resolves to that row's user_id. This is
 *      the multi-user path — each user mints their own token in Settings.
 *   2. Single shared-secret fallback (MCP_SHARED_SECRET → MCP_USER_ID env):
 *      kept so an existing single-user setup keeps working without a DB token.
 *
 * Transport mode: stateless. A fresh McpServer + transport pair is created per
 * request and torn down when the response closes. This avoids server-side
 * session state, which keeps things simple and robust on platforms like Render.
 */

export const mcpRoutes = Router();

const MCP_SHARED_SECRET = process.env.MCP_SHARED_SECRET || '';
const MCP_USER_ID = parseInt(process.env.MCP_USER_ID || '', 10);

/** SHA-256 hex of a raw token — the form stored in mcp_tokens.token_hash. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/** Constant-time string comparison (avoids leaking length-independent timing). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Resolve the bearer token to a user id, or null if unauthorized.
 * Checks the shared-secret env fallback first (cheap, no DB), then the
 * mcp_tokens table. Bumps last_used_at on a DB token match (best-effort).
 */
async function resolveUser(req: Request): Promise<number | null> {
  const token = extractBearer(req);
  if (!token) return null;

  // 1. Shared-secret env fallback
  if (
    MCP_SHARED_SECRET &&
    !Number.isNaN(MCP_USER_ID) &&
    timingSafeEqual(token, MCP_SHARED_SECRET)
  ) {
    return MCP_USER_ID;
  }

  // 2. Per-user DB token lookup (by hash)
  try {
    const result = await pool.query(
      'SELECT id, user_id FROM mcp_tokens WHERE token_hash = $1 AND revoked = FALSE',
      [hashToken(token)],
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    // Best-effort last-used timestamp; don't fail the request if this errors.
    pool
      .query('UPDATE mcp_tokens SET last_used_at = NOW() WHERE id = $1', [
        row.id,
      ])
      .catch(() => {});
    return row.user_id;
  } catch (err) {
    console.error('MCP token lookup failed:', err);
    return null;
  }
}

function unauthorized(res: Response) {
  res.status(401).json({
    jsonrpc: '2.0',
    error: { code: -32001, message: 'Unauthorized' },
    id: null,
  });
}

/**
 * Handle an MCP request in stateless mode. express.json() has already parsed
 * the body for POST; we pass it through to the transport.
 */
async function handleMcp(req: Request, res: Response) {
  const userId = await resolveUser(req);
  if (userId === null) return unauthorized(res);

  const server = buildMcpServer(userId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  res.on('close', () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    // The transport operates on raw Node req/res. Our Express Request carries a
    // different `auth` augmentation (JWT AuthPayload) than the SDK's AuthInfo,
    // and we don't use the transport's own auth, so cast to the Node types.
    await transport.handleRequest(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      req.body,
    );
  } catch (err) {
    console.error('MCP request error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}

// Streamable HTTP uses POST for requests; GET/DELETE are used by the protocol
// for the (here unused) session/stream lifecycle. In stateless mode GET/DELETE
// have no session to act on, so we reject them cleanly after the auth gate.
mcpRoutes.post('/', handleMcp);

mcpRoutes.get('/', async (req, res) => {
  if ((await resolveUser(req)) === null) return unauthorized(res);
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed (stateless server)' },
    id: null,
  });
});

mcpRoutes.delete('/', async (req, res) => {
  if ((await resolveUser(req)) === null) return unauthorized(res);
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed (stateless server)' },
    id: null,
  });
});
