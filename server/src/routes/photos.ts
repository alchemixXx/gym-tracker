import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { pool } from '../db/pool.js';

// Use memory storage — files are kept in buffer, not written to disk
const upload = multer({
  storage: multer.memoryStorage(),
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
export const photoImageRoutes = Router();

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
        [measurementId, userId],
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Measurement not found' });
      }

      const saved = [];
      for (const file of files) {
        const result = await pool.query(
          'INSERT INTO measurement_photos (measurement_id, original_name, data, mime_type) VALUES ($1, $2, $3, $4) RETURNING id, measurement_id, original_name, mime_type, created_at',
          [measurementId, file.originalname, file.buffer, file.mimetype],
        );
        saved.push(result.rows[0]);
      }

      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ error: 'Failed to upload photos' });
    }
  },
);

// GET /api/users/:userId/measurements/:measurementId/photos — list photos (metadata only)
photoRoutes.get(
  '/:userId/measurements/:measurementId/photos',
  async (req, res) => {
    const { userId, measurementId } = req.params;
    try {
      const check = await pool.query(
        'SELECT id FROM body_measurements WHERE id = $1 AND user_id = $2',
        [measurementId, userId],
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Measurement not found' });
      }

      const result = await pool.query(
        'SELECT id, measurement_id, original_name, mime_type, created_at FROM measurement_photos WHERE measurement_id = $1 ORDER BY created_at',
        [measurementId],
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch photos' });
    }
  },
);

// GET /api/photos/:photoId/image — serve photo binary from DB
photoImageRoutes.get('/:photoId/image', async (req, res) => {
  const { photoId } = req.params;
  try {
    const result = await pool.query(
      'SELECT data, mime_type, original_name FROM measurement_photos WHERE id = $1',
      [photoId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const { data, mime_type, original_name } = result.rows[0];
    res.set('Content-Type', mime_type || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to serve photo' });
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
         RETURNING mp.id`,
        [photoId, measurementId, userId],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      res.json({ message: 'Photo deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete photo' });
    }
  },
);
