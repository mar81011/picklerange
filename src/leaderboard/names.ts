// Player-name rules shared by the game and the phone-entry server.
// Kept dependency-free with plain JS syntax so Node can run it directly.

export const MAX_NAME_LENGTH = 10;

/**
 * Uppercases, keeps letters, digits and single spaces, and trims to
 * MAX_NAME_LENGTH. Returns null if nothing usable remains.
 */
export function sanitizeName(raw: string): string | null {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // ñ -> n, ë -> e
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}
