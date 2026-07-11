// ============================================================
// หารกัน (HanGun) — id / token generators (server-only)
// ============================================================

import { randomBytes } from 'crypto';

// no ambiguous characters (0/O/1/l/i)
const CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

/** short, readable public code embedded in the join URL / QR */
export function makeJoinCode(len = 8): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** long secret the owner's browser keeps to prove ownership */
export function makeOwnerToken(): string {
  return randomBytes(24).toString('base64url');
}
