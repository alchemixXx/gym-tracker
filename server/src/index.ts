import express from 'express';
import cors from 'cors';
import { pool } from './db/pool.js';
import { userRoutes } from './routes/users.js';
import { templateRoutes } from './routes/templates.js';
import { programRoutes } from './routes/programs.js';
import { measurementRoutes } from './routes/measurements.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/users', templateRoutes);
app.use('/api/users', programRoutes);
app.use('/api/users', measurementRoutes);

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
