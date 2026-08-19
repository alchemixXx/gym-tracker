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
import { photoRoutes } from './routes/photos.js';
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

// Android App Links verification
app.get('/.well-known/assetlinks.json', (_req, res) => {
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.gymtracker.app',
        sha256_cert_fingerprints: [
          'C4:41:53:A0:36:BF:38:D3:E2:98:AF:CC:C4:B0:B1:9D:13:20:9C:FD:3C:88:BE:82:5A:05:D6:DC:17:38:9C:0B',
        ],
      },
    },
  ]);
});

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
  app.get('*', (req, res) => {
    // Don't serve SPA for API or well-known routes
    if (req.path.startsWith('/api') || req.path.startsWith('/.well-known')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
