import { Router } from 'express';
import { randomBytes } from 'crypto';
import { pool } from '../db/pool.js';
import { hashToken } from '../mcp/http.js';

export const mcpTokenRoutes = Router();

/**
 * MCP token management. Mounted under the protected user-data router, so
 * requireAuth + ownership (token.sub === :userId) are already enforced — a user
 * can only manage their own MCP tokens.
 *
 * The raw token is returned ONCE on creation and never stored; only its
 * SHA-256 hash lives in the DB.
 */

// GET /api/users/:userId/mcp-tokens — list the user's tokens (metadata only)
mcpTokenRoutes.get('/:userId/mcp-tokens', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, label, created_at, last_used_at, revoked
       FROM mcp_tokens WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.params.userId],
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch MCP tokens' });
  }
});

// POST /api/users/:userId/mcp-tokens — create a token; returns the raw value once
mcpTokenRoutes.post('/:userId/mcp-tokens', async (req, res) => {
  const { userId } = req.params;
  const { label } = req.body;

  try {
    // 32 random bytes → 64 hex chars. Prefixed for easy recognition.
    const raw = `gymmcp_${randomBytes(32).toString('hex')}`;
    const token_hash = hashToken(raw);

    const result = await pool.query(
      `INSERT INTO mcp_tokens (user_id, token_hash, label)
       VALUES ($1, $2, $3)
       RETURNING id, label, created_at, last_used_at, revoked`,
      [userId, token_hash, (label || '').trim() || null],
    );

    // Return the raw token exactly once — it cannot be retrieved again.
    res.status(201).json({ ...result.rows[0], token: raw });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create MCP token' });
  }
});

// DELETE /api/users/:userId/mcp-tokens/:id — revoke (soft-delete) a token
mcpTokenRoutes.delete('/:userId/mcp-tokens/:id', async (req, res) => {
  const { userId, id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE mcp_tokens SET revoked = TRUE
       WHERE id = $1 AND user_id = $2 AND revoked = FALSE
       RETURNING id`,
      [id, userId],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: 'Token not found or already revoked' });
    }
    res.json({ message: 'Token revoked' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke MCP token' });
  }
});
