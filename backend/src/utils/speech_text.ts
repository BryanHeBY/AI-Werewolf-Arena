const RESERVED_PREFIX = /^(\s*\[(上帝|法官|系统|God|Judge|System)\]\s*)+/gi;
/** Shared by execution and reproduction validation; never remove embedded user text. */
export function sanitizeSpeechText(raw: string): string {
  return raw.replace(RESERVED_PREFIX, "").trim();
}
