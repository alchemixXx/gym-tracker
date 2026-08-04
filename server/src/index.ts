import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db/pool.js';
import { requireAuth } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { templateRoutes } from './routes/templates.js';
import { programRoutes } from './routes/programs.js';
import { measurementRoutes } from './routes/measurements.js';
import { foodRoutes } from './routes/food.js';
import { photoRoutes, photoImageRoutes } from './routes/photos.js';
import { syncRoutes } from './routes/sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Public routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes — require authentication
// User CRUD (used for /api/users/me endpoint)
app.use('/api/users', requireAuth, userRoutes);

// All user-scoped data routes — require auth + ownership
// These routes all use /:userId/... paths internally
const protectedUserData = express.Router({ mergeParams: true });
protectedUserData.use(requireAuth);
protectedUserData.param('userId', (req, res, next, userId) => {
  if (!req.auth) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (parseInt(userId, 10) !== req.auth.sub) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
});
protectedUserData.use(templateRoutes);
protectedUserData.use(programRoutes);
protectedUserData.use(measurementRoutes);
protectedUserData.use(foodRoutes);
protectedUserData.use(photoRoutes);
protectedUserData.use(syncRoutes);
app.use('/api/users', protectedUserData);

// Serve photo images directly from DB (protected)
app.use('/api/photos', requireAuth, photoImageRoutes);

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
