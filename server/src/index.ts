import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db/pool.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { templateRoutes } from './routes/templates.js';
import { programRoutes } from './routes/programs.js';
import { measurementRoutes } from './routes/measurements.js';
import { foodRoutes } from './routes/food.js';
import { photoRoutes, serveUploads } from './routes/photos.js';
import { requireAuth } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Protected routes — require valid token
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/users', requireAuth, templateRoutes);
app.use('/api/users', requireAuth, programRoutes);
app.use('/api/users', requireAuth, measurementRoutes);
app.use('/api/users', requireAuth, foodRoutes);
app.use('/api/users', requireAuth, photoRoutes);

// Serve uploaded photos
serveUploads(app);

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
