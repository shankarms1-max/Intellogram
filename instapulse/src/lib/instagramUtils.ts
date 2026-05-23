/**
 * Strips @, extracts from Instagram URL, lowercases, validates pattern.
 * Returns null if the result is not a valid Instagram username.
 * Safe to use in both server and client code.
 */
export function normalizeInstagramUsername(input: string): string | null {
  let s = input.trim();
  if (!s) return null;

  // Extract username from instagram.com URLs
  const urlMatch = s.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
  if (urlMatch) {
    s = urlMatch[1];
  } else {
    // Strip leading @
    s = s.replace(/^@+/, "");
    // Strip trailing slash
    s = s.replace(/\/$/, "");
  }

  s = s.toLowerCase();

  // Must match Instagram username rules: letters, numbers, dots, underscores, 1–30 chars
  if (!/^[a-z0-9_.]{1,30}$/.test(s)) return null;
  return s;
}
