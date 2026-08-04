import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export interface AuthPayload {
  sub: number; // user id
  email: string;
}

// Extend Express Request to carry auth info
declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

/**
 * Middleware that verifies the JWT access token from the Authorization header.
 * Attaches `req.auth` with { sub, email } on success.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as AuthPayload;
    req.auth = payload;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware that enforces the authenticated user can only access their own data.
 * Must be used AFTER requireAuth on routes with :userId param.
 */
export function requireOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = parseInt(req.params.userId, 10);

  if (!req.auth) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (userId !== req.auth.sub) {
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
}
