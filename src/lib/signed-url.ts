import { supabase } from "@/integrations/supabase/client";

/**
 * Generate a temporary signed URL for a file stored in a private bucket.
 * Accepts either a relative storage path or a legacy full public URL
 * (older records may have stored the full public URL).
 */
export async function getSignedUrl(
  bucket: string,
  pathOrUrl: string | null | undefined,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!pathOrUrl) return null;

  let path = pathOrUrl;
  const publicMarker = `/object/public/${bucket}/`;
  if (path.includes(publicMarker)) {
    path = path.split(publicMarker)[1];
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error(`Failed to create signed URL for ${bucket}/${path}:`, error);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Generate signed URLs for many paths in the same bucket.
 * Returns a map keyed by the original path/URL.
 */
export async function getSignedUrlMap(
  bucket: string,
  pathsOrUrls: (string | null | undefined)[],
  expiresInSeconds = 3600
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const unique = Array.from(
    new Set(pathsOrUrls.filter((p): p is string => !!p))
  );

  await Promise.all(
    unique.map(async (original) => {
      const signed = await getSignedUrl(bucket, original, expiresInSeconds);
      if (signed) result[original] = signed;
    })
  );

  return result;
}
