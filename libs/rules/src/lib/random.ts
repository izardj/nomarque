// Reproducible pseudo-random numbers. A draw depends only on the nome's seed
// and on a key naming what is drawn (the draw instant, the card choice), so
// replaying an interval in one or several steps draws the same values.

/** A number in [0, 1) for this seed and key. */
export function randomUnit(seed: string, ...key: (string | number)[]): number {
  const text = [seed, ...key].join(':');
  // cyrb53-style hash: two 32-bit lanes mixed into a 53-bit integer.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return hash / 2 ** 53;
}
