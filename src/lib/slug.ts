const SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyz234567';

/** Short URL-safe slug (no ambiguous chars). */
export function generateShareSlug(length = 8): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SLUG_CHARS[buf[i] % SLUG_CHARS.length];
  }
  return out;
}

export function isLikelyFirestoreDocId(param: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(param);
}
