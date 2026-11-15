import { createHash, randomBytes } from 'node:crypto';

/** A random secret for a link or a cookie: 256 bits, URL-safe. */
export function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** Only this hash is stored, so a database leak does not leak live secrets. */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
