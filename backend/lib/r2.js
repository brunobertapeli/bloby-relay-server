import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET;
const PREFIX = 'static/';

/**
 * Upload a buffer to R2.
 * @param {string} key — e.g. "skills/whatsapp-1.0.0.tar.gz" (prefix added automatically)
 * @param {Buffer} buffer
 * @param {string} [contentType='application/gzip']
 */
export async function upload(key, buffer, contentType = 'application/gzip') {
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: PREFIX + key,
    Body: buffer,
    ContentType: contentType,
  }));
}

/**
 * Get a file from R2. Returns readable stream + content length + content type.
 * @param {string} key — e.g. "skills/whatsapp-1.0.0.tar.gz" (prefix added automatically)
 */
export async function getFile(key) {
  const res = await client.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: PREFIX + key,
  }));
  return { stream: res.Body, contentLength: res.ContentLength, contentType: res.ContentType };
}

/**
 * Delete a file from R2.
 * @param {string} key (prefix added automatically)
 */
export async function deleteFile(key) {
  await client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: PREFIX + key,
  }));
}
