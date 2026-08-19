import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import crypto from 'crypto';
import path from 'path';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!; // e.g. https://photos.yourdomain.com

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate a unique storage key for a photo, scoped to a user.
 */
function generateKey(userId: number, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const id = crypto.randomUUID();
  return `gym_app/${userId}/${id}${ext}`;
}

/**
 * Upload a file buffer to Cloudflare R2.
 * Returns { key, url } where url is the publicly-accessible URL.
 */
export async function uploadToR2(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  userId: number,
): Promise<{ key: string; url: string }> {
  const key = generateKey(userId, originalName);

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  const url = `${R2_PUBLIC_URL}/${key}`;
  return { key, url };
}

/**
 * Delete a file from Cloudflare R2 by its storage key.
 */
export async function deleteFromR2(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  );
}
