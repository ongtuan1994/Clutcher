/**
 * Public URLs for user-uploaded assets (avatars, sky images).
 * - Local dev: relative paths proxied by Vite, or set PUBLIC_API_URL for absolute URLs.
 * - Cloud Run + Firebase: set PUBLIC_API_URL to the API URL, or use GCS (recommended).
 */
export function avatarPublicUrl(filename: string | null): string | null {
  if (!filename) return null;
  return publicUrlForStoredPath(`avatars/${filename}`);
}

export function skyAssetPublicUrl(filename: string | null): string | null {
  if (!filename) return null;
  return publicUrlForStoredPath(`sky/${filename}`);
}

function publicUrlForStoredPath(objectPath: string): string {
  const bucket = process.env.GCS_BUCKET?.trim();
  if (bucket) {
    const explicit = process.env.GCS_PUBLIC_BASE_URL?.trim();
    if (explicit) {
      return `${explicit.replace(/\/$/, '')}/${objectPath}`;
    }
    return `https://storage.googleapis.com/${bucket}/${objectPath}`;
  }
  const api = process.env.PUBLIC_API_URL?.trim().replace(/\/$/, '');
  const rel = `/uploads/${objectPath}`;
  return api ? `${api}${rel}` : rel;
}
