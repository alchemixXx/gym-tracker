import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db/pool.js';
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

// Routes
app.use('/api/users', userRoutes);
app.use('/api/users', templateRoutes);
app.use('/api/users', programRoutes);
app.use('/api/users', measurementRoutes);
app.use('/api/users', foodRoutes);
app.use('/api/users', photoRoutes);
app.use('/api/users', syncRoutes);

// Serve photo images directly from DB
app.use('/api/photos', photoImageRoutes);

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
