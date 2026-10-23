import { timingSafeEqual } from 'crypto';

/**
 * Constant-time secret comparison.
 * Returns false if either side is missing or empty, so an unset
 * environment variable can never be "matched" by an absent header/query.
 */
export function secretMatches(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (provided.length === 0 || expected.length === 0) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * True only on the Vercel production deployment.
 */
export function isProductionDeployment() {
  return process.env.VERCEL_ENV === 'production';
}
