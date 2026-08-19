import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { pool } from '../db/pool.js';
import { uploadToR2, deleteFromR2 } from '../services/storage.js';

// Use memory storage — files are kept in buffer before uploading to R2
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
        // Upload to Cloudflare R2
        const { key, url } = await uploadToR2(
          file.buffer,
          file.originalname,
          file.mimetype,
          parseInt(userId, 10),
        );

        // Store reference in DB (no binary data)
        const result = await pool.query(
          `INSERT INTO measurement_photos (measurement_id, original_name, mime_type, storage_key, url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, measurement_id, original_name, mime_type, url, created_at`,
          [measurementId, file.originalname, file.mimetype, key, url],
        );
        saved.push(result.rows[0]);
      }

      res.status(201).json(saved);
    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(500).json({ error: 'Failed to upload photos' });
    }
  },
);

// GET /api/users/:userId/measurements/:measurementId/photos — list photos (metadata + url)
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
        'SELECT id, measurement_id, original_name, mime_type, url, created_at FROM measurement_photos WHERE measurement_id = $1 ORDER BY created_at',
        [measurementId],
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch photos' });
    }
  },
);

// DELETE /api/users/:userId/measurements/:measurementId/photos/:photoId
photoRoutes.delete(
  '/:userId/measurements/:measurementId/photos/:photoId',
  async (req, res) => {
    const { userId, measurementId, photoId } = req.params;
    try {
      // Fetch the storage key before deleting
      const result = await pool.query(
        `SELECT mp.id, mp.storage_key
         FROM measurement_photos mp
         JOIN body_measurements bm ON bm.id = mp.measurement_id
         WHERE mp.id = $1
           AND mp.measurement_id = $2
           AND bm.user_id = $3`,
        [photoId, measurementId, userId],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      const { storage_key } = result.rows[0];

      // Delete from R2
      if (storage_key) {
        await deleteFromR2(storage_key);
      }

      // Delete from DB
      await pool.query('DELETE FROM measurement_photos WHERE id = $1', [
        photoId,
      ]);

      res.json({ message: 'Photo deleted' });
    } catch (error) {
      console.error('Photo delete error:', error);
      res.status(500).json({ error: 'Failed to delete photo' });
    }
  },
);
