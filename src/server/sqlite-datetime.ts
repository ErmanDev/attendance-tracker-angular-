/**
 * SQLite `datetime('now')` stores UTC as "YYYY-MM-DD HH:MM:SS" with no timezone.
 * `new Date("YYYY-MM-DD HH:MM:SS")` in JS treats that as *local* time, so clocks are wrong.
 * Convert to ISO-8601 with explicit `Z` so the client shows the user's system timezone correctly.
 */
export function sqliteUtcToIso8601(value: string): string {
  const s = value.trim();
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
    return s;
  }
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(s);
  if (m) {
    const frac = m[3] ?? '';
    return `${m[1]}T${m[2]}${frac}Z`;
  }
  return s;
}
