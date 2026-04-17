import { Storage } from '@google-cloud/storage';

let storage: Storage | null = null;

function getBucket() {
  const name = process.env.GCS_BUCKET?.trim();
  if (!name) return null;
  if (!storage) storage = new Storage();
  return storage.bucket(name);
}

export function isGcsConfigured(): boolean {
  return Boolean(process.env.GCS_BUCKET?.trim());
}

export async function writeObject(key: string, data: Buffer, contentType: string): Promise<void> {
  const bucket = getBucket();
  if (!bucket) throw new Error('GCS_BUCKET is not set');
  await bucket.file(key).save(data, {
    contentType,
    resumable: false,
    metadata: { cacheControl: 'public, max-age=31536000' },
  });
}

export async function deleteObject(key: string): Promise<void> {
  const bucket = getBucket();
  if (!bucket) return;
  try {
    await bucket.file(key).delete({ ignoreNotFound: true });
  } catch {
    /* ignore */
  }
}
