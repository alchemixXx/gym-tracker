import { Router, type Request, type Response } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildMcpServer } from './server.js';

/**
 * Express router that exposes the gym-tracker MCP server over Streamable HTTP
 * at POST/GET/DELETE /mcp, mounted on the main app.
 *
 * Auth: a single shared secret (MCP_SHARED_SECRET) sent as
 *   Authorization: Bearer <secret>
 * maps to one fixed user (MCP_USER_ID). This is a deliberate single-user design
 * for a personal deployment. To support multiple users later, replace
 * resolveUser() with a per-secret lookup (e.g. a tokens table).
 *
 * Transport mode: stateless. A fresh McpServer + transport pair is created per
 * request and torn down when the response closes. This avoids server-side
 * session state, which keeps things simple and robust on platforms like Render.
 */

export const mcpRoutes = Router();

const MCP_SHARED_SECRET = process.env.MCP_SHARED_SECRET || '';
const MCP_USER_ID = parseInt(process.env.MCP_USER_ID || '', 10);

function resolveUser(req: Request): number | null {
  if (!MCP_SHARED_SECRET || Number.isNaN(MCP_USER_ID)) {
    // Not configured — treat as disabled rather than insecurely open.
    return null;
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();

  // Constant-time-ish comparison: length check then char compare.
  if (token.length !== MCP_SHARED_SECRET.length) return null;
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ MCP_SHARED_SECRET.charCodeAt(i);
  }
  return mismatch === 0 ? MCP_USER_ID : null;
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
  const userId = resolveUser(req);
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

mcpRoutes.get('/', (req, res) => {
  if (resolveUser(req) === null) return unauthorized(res);
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed (stateless server)' },
    id: null,
  });
});

mcpRoutes.delete('/', (req, res) => {
  if (resolveUser(req) === null) return unauthorized(res);
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed (stateless server)' },
    id: null,
  });
});
