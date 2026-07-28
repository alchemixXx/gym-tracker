import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from '../db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `photo-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|webp|heic)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export const photoRoutes = Router();

// POST /api/users/:userId/measurements/:measurementId/photos — upload photos
photoRoutes.post(
  '/:userId/measurements/:measurementId/photos',
  upload.array('photos', 10),
  async (req, res) => {
    const { userId, measurementId } = req.params;
    const files = req.files as Express.Multer.File[];

    try {
      // Verify measurement belongs to user
      const check = await pool.query(
        'SELECT id FROM body_measurements WHERE id = $1 AND user_id = $2',
        [measurementId, userId]
      );
      if (check.rows.length === 0) {
        // Clean up uploaded files
        for (const f of files) fs.unlinkSync(f.path);
        return res.status(404).json({ error: 'Measurement not found' });
      }

      const saved = [];
      for (const file of files) {
        const result = await pool.query(
          'INSERT INTO measurement_photos (measurement_id, filename, original_name) VALUES ($1, $2, $3) RETURNING *',
          [measurementId, file.filename, file.originalname]
        );
        saved.push(result.rows[0]);
      }

      res.status(201).json(saved);
    } catch (error) {
      // Clean up on error
      for (const f of files) {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      }
      res.status(500).json({ error: 'Failed to upload photos' });
    }
  }
);

// GET /api/users/:userId/measurements/:measurementId/photos — list photos
photoRoutes.get('/:userId/measurements/:measurementId/photos', async (req, res) => {
  const { userId, measurementId } = req.params;
  try {
    const check = await pool.query(
      'SELECT id FROM body_measurements WHERE id = $1 AND user_id = $2',
      [measurementId, userId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Measurement not found' });
    }

    const result = await pool.query(
      'SELECT * FROM measurement_photos WHERE measurement_id = $1 ORDER BY created_at',
      [measurementId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// DELETE /api/users/:userId/measurements/:measurementId/photos/:photoId
photoRoutes.delete(
  '/:userId/measurements/:measurementId/photos/:photoId',
  async (req, res) => {
    const { userId, measurementId, photoId } = req.params;
    try {
      const result = await pool.query(
        `DELETE FROM measurement_photos mp
         USING body_measurements bm
         WHERE mp.id = $1
           AND mp.measurement_id = $2
           AND bm.id = mp.measurement_id
           AND bm.user_id = $3
         RETURNING mp.filename`,
        [photoId, measurementId, userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      // Delete file from disk
      const filePath = path.join(UPLOADS_DIR, result.rows[0].filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      res.json({ message: 'Photo deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete photo' });
    }
  }
);

// Serve uploaded photos — GET /api/uploads/:filename
export function serveUploads(app: import('express').Application) {
  app.use('/api/uploads', (req, res, next) => {
    // Only serve files that exist, prevent path traversal
    const filename = path.basename(req.path);
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  });
}
