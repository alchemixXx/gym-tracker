import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthPayload } from '../middleware/auth.js';

export const authRoutes = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = parseInt(
  process.env.REFRESH_TOKEN_DAYS || '180',
  10,
);
const MAGIC_LINK_EXPIRY_MINUTES = 15;

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// --- Email transporter (created lazily to ensure env vars are loaded) ---
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error(
        'SMTP credentials missing! Set SMTP_USER and SMTP_PASS environment variables.',
        'Available env keys:',
        Object.keys(process.env).filter((k) => k.startsWith('SMTP')),
      );
    }
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

// --- Helpers ---

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function createAccessToken(userId: number, email: string): string {
  return jwt.sign({ sub: userId, email } as AuthPayload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

async function createRefreshToken(userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt],
  );

  return token;
}

// --- Routes ---

/**
 * POST /api/auth/magic-link
 * Body: { email: string }
 * Sends a magic link to the provided email. Creates a user if one doesn't exist.
 */
authRoutes.post('/magic-link', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    // Generate magic link token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + MAGIC_LINK_EXPIRY_MINUTES);

    // Store magic link
    await pool.query(
      'INSERT INTO magic_links (email, token, expires_at) VALUES ($1, $2, $3)',
      [normalizedEmail, token, expiresAt],
    );

    // Send email
    const magicLinkUrl = `${APP_URL}/auth/verify?token=${token}`;
    const appLinkUrl = `gymtracker://auth/verify?token=${token}`;

    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: normalizedEmail,
      subject: 'Вхід у Gym Tracker',
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4F46E5;">Gym Tracker</h2>
          <p>Натисніть кнопку нижче, щоб увійти:</p>
          <a href="${appLinkUrl}" 
             style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
            Відкрити в додатку
          </a>
          <p style="margin-top: 12px;">
            <a href="${magicLinkUrl}" style="color: #4F46E5; font-size: 14px;">
              Або відкрити у браузері
            </a>
          </p>
          <p style="color: #6B7280; font-size: 14px;">
            Посилання дійсне ${MAGIC_LINK_EXPIRY_MINUTES} хвилин.<br>
            Якщо ви не запитували вхід — проігноруйте цей лист.
          </p>
        </div>
      `,
    });

    res.json({ message: 'Magic link sent' });
  } catch (error) {
    console.error('Failed to send magic link:', error);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

/**
 * POST /api/auth/verify
 * Body: { token: string }
 * Verifies the magic link token.
 *
 * If the email already belongs to a user → issues tokens directly.
 * If the email is new AND there are unclaimed users (users without email) →
 *   returns { needsClaim: true, claimToken, unclaimedUsers } so the client
 *   can show the "claim account" screen.
 * If the email is new AND no unclaimed users exist → creates a new user.
 */
authRoutes.post('/verify', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    // Find and validate the magic link
    const result = await pool.query(
      'SELECT * FROM magic_links WHERE token = $1 AND used = FALSE AND expires_at > NOW()',
      [token],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired link' });
    }

    const magicLink = result.rows[0];

    // Mark magic link as used
    await pool.query('UPDATE magic_links SET used = TRUE WHERE id = $1', [
      magicLink.id,
    ]);

    // Check if a user with this email already exists
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [magicLink.email],
    );

    if (userResult.rows.length > 0) {
      // Existing user — issue tokens directly
      const user = userResult.rows[0];
      const accessToken = createAccessToken(user.id, user.email);
      const refreshToken = await createRefreshToken(user.id);

      return res.json({
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email },
      });
    }

    // Email is new — check for unclaimed users (users without an email)
    const unclaimedResult = await pool.query(
      'SELECT id, name, created_at FROM users WHERE email IS NULL ORDER BY name',
    );

    if (unclaimedResult.rows.length > 0) {
      // There are unclaimed profiles — issue a short-lived claim token
      // so the client can pick one or create new
      const claimToken = jwt.sign(
        { email: magicLink.email, purpose: 'claim' },
        JWT_SECRET,
        { expiresIn: '10m' },
      );

      return res.json({
        needsClaim: true,
        claimToken,
        unclaimedUsers: unclaimedResult.rows,
      });
    }

    // No unclaimed users — create a fresh account
    const name = magicLink.email.split('@')[0];
    const newUser = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, magicLink.email],
    );
    const user = newUser.rows[0];

    const accessToken = createAccessToken(user.id, user.email);
    const refreshToken = await createRefreshToken(user.id);

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error('Failed to verify magic link:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * POST /api/auth/claim
 * Body: { claimToken: string, userId?: number }
 *
 * Links an email (from claimToken) to an existing unclaimed user.
 * If userId is omitted or null, creates a new user instead.
 */
authRoutes.post('/claim', async (req, res) => {
  const { claimToken, userId } = req.body;

  if (!claimToken) {
    return res.status(400).json({ error: 'Claim token is required' });
  }

  try {
    // Verify claim token
    const payload = jwt.verify(claimToken, JWT_SECRET) as unknown as {
      email: string;
      purpose: string;
    };

    if (payload.purpose !== 'claim') {
      return res.status(401).json({ error: 'Invalid claim token' });
    }

    const email = payload.email;

    // Check email isn't already taken (race condition guard)
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      email,
    ]);
    if (existing.rows.length > 0) {
      return res
        .status(409)
        .json({ error: 'Email already linked to another account' });
    }

    let user;

    if (userId) {
      // Claim an existing unclaimed user
      const claimResult = await pool.query(
        'UPDATE users SET email = $1 WHERE id = $2 AND email IS NULL RETURNING *',
        [email, userId],
      );

      if (claimResult.rows.length === 0) {
        return res
          .status(404)
          .json({ error: 'User not found or already claimed' });
      }

      user = claimResult.rows[0];
    } else {
      // Create a fresh user
      const name = email.split('@')[0];
      const newUser = await pool.query(
        'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
        [name, email],
      );
      user = newUser.rows[0];
    }

    // Issue tokens
    const accessToken = createAccessToken(user.id, user.email);
    const refreshToken = await createRefreshToken(user.id);

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res
        .status(401)
        .json({ error: 'Claim token expired — request a new magic link' });
    }
    console.error('Failed to claim account:', err);
    res.status(500).json({ error: 'Claim failed' });
  }
});

/**
 * POST /api/auth/refresh
 * Body: { refreshToken: string }
 * Issues a new access token (and rotates the refresh token).
 */
authRoutes.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    // Find valid refresh token
    const result = await pool.query(
      'SELECT rt.*, u.email, u.name FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token = $1 AND rt.revoked = FALSE AND rt.expires_at > NOW()',
      [refreshToken],
    );

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ error: 'Invalid or expired refresh token' });
    }

    const row = result.rows[0];

    // Revoke old refresh token (rotation)
    await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1', [
      row.id,
    ]);

    // Issue new tokens
    const newAccessToken = createAccessToken(row.user_id, row.email);
    const newRefreshToken = await createRefreshToken(row.user_id);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: { id: row.user_id, name: row.name, email: row.email },
    });
  } catch (error) {
    console.error('Failed to refresh token:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /api/auth/logout
 * Body: { refreshToken: string }
 * Revokes the refresh token.
 */
authRoutes.post('/logout', requireAuth, async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    await pool.query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1 AND user_id = $2',
      [refreshToken, req.auth!.sub],
    );
  }

  res.json({ message: 'Logged out' });
});

/**
 * GET /api/auth/me
 * Returns the current authenticated user.
 */
authRoutes.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.auth!.sub],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});
