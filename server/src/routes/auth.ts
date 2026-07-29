import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { pool } from '../db/pool.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  setTokenCookies,
  clearTokenCookies,
  TokenPayload,
} from '../middleware/auth.js';

export const authRoutes = Router();

const SALT_ROUNDS = 12;

// --- Email transport ---

function getMailTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  });
}

const FROM_EMAIL = process.env.SMTP_FROM || 'noreply@gym-tracker.app';

// --- POST /api/auth/register ---
authRoutes.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Check if email is already taken
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, is_claimed) VALUES ($1, $2, $3, TRUE) RETURNING id, name, email, created_at',
      [name.trim(), email.trim().toLowerCase(), passwordHash]
    );

    const user = result.rows[0];
    const payload: TokenPayload = { userId: user.id, email: user.email };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// --- POST /api/auth/login ---
authRoutes.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const payload: TokenPayload = { userId: user.id, email: user.email };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    setTokenCookies(res, accessToken, refreshToken);

    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- POST /api/auth/claim ---
// Existing (unclaimed) user sets email + password to claim their account
authRoutes.post('/claim', async (req, res) => {
  const { userId, email, password } = req.body;

  if (!userId || !email?.trim() || !password) {
    return res.status(400).json({ error: 'userId, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Verify user exists and is unclaimed
    const userResult = await pool.query(
      'SELECT id, name, is_claimed FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userResult.rows[0].is_claimed) {
      return res.status(400).json({ error: 'Account already claimed' });
    }

    // Check if email is already taken
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      'UPDATE users SET email = $1, password_hash = $2, is_claimed = TRUE WHERE id = $3 RETURNING id, name, email',
      [email.trim().toLowerCase(), passwordHash, userId]
    );

    const user = result.rows[0];
    const payload: TokenPayload = { userId: user.id, email: user.email };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    setTokenCookies(res, accessToken, refreshToken);

    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Claim error:', error);
    res.status(500).json({ error: 'Failed to claim account' });
  }
});

// --- POST /api/auth/refresh ---
authRoutes.post('/refresh', async (req, res) => {
  const token = req.cookies?.refresh_token;

  if (!token) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const payload = verifyToken(token);

    // Verify user still exists
    const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [payload.userId]);
    if (result.rows.length === 0) {
      clearTokenCookies(res);
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const newPayload: TokenPayload = { userId: user.id, email: user.email };

    const accessToken = generateAccessToken(newPayload);
    const refreshToken = generateRefreshToken(newPayload);
    setTokenCookies(res, accessToken, refreshToken);

    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    clearTokenCookies(res);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// --- POST /api/auth/logout ---
authRoutes.post('/logout', (_req, res) => {
  clearTokenCookies(res);
  res.json({ message: 'Logged out' });
});

// --- POST /api/auth/forgot-password ---
authRoutes.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email?.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, expires, result.rows[0].id]
    );

    // Send reset email
    const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    try {
      const transport = getMailTransport();
      await transport.sendMail({
        from: FROM_EMAIL,
        to: email.trim().toLowerCase(),
        subject: 'Скидання пароля — Gym Tracker',
        html: `
          <h2>Скидання пароля</h2>
          <p>Натисніть на посилання нижче, щоб скинути пароль:</p>
          <p><a href="${resetUrl}">Скинути пароль</a></p>
          <p>Посилання дійсне протягом 1 години.</p>
          <p>Якщо ви не запитували скидання пароля, проігноруйте цей лист.</p>
        `,
      });
    } catch (mailErr) {
      console.error('Failed to send reset email:', mailErr);
      // Don't expose mail failure to user — token is saved, they could retry
    }

    res.json({ message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// --- POST /api/auth/reset-password ---
authRoutes.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = result.rows[0];
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    // Auto-login after reset
    const payload: TokenPayload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    setTokenCookies(res, accessToken, refreshToken);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// --- GET /api/auth/me ---
// Returns current user from token (used by client on app load)
authRoutes.get('/me', async (req, res) => {
  const token = req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const payload = verifyToken(token);
    const result = await pool.query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [payload.userId]
    );

    if (result.rows.length === 0) {
      clearTokenCookies(res);
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// --- GET /api/auth/unclaimed-users ---
// Lists unclaimed users for the claim flow
authRoutes.get('/unclaimed-users', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM users WHERE is_claimed = FALSE ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Unclaimed users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});
