// Test helpers only: imported by spec files, never by the library itself.

const RELATIVE = 1e-6;
const ABSOLUTE = 1e-6;

/**
 * Deep equality where numbers match up to rounding. Missing amounts count as
 * zero, so `{}` and `{ wheat: 1e-12 }` are equal.
 */
export function expectClose(
  actual: unknown,
  expected: unknown,
  path = '$',
): void {
  const mismatch = findMismatch(actual, expected, path);
  if (mismatch) {
    throw new Error(mismatch);
  }
}

function findMismatch(
  actual: unknown,
  expected: unknown,
  path: string,
): string | null {
  if (typeof actual === 'number' || typeof expected === 'number') {
    const a = typeof actual === 'number' ? actual : 0;
    const e = typeof expected === 'number' ? expected : 0;
    const tolerance = Math.max(
      ABSOLUTE,
      RELATIVE * Math.max(Math.abs(a), Math.abs(e)),
    );
    return Math.abs(a - e) <= tolerance ? null : `${path}: ${a} ≠ ${e}`;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      return `${path}: length ${actual.length} ≠ ${expected.length} (${JSON.stringify(actual)} vs ${JSON.stringify(expected)})`;
    }
    for (let i = 0; i < actual.length; i++) {
      const m = findMismatch(actual[i], expected[i], `${path}[${i}]`);
      if (m) {
        return m;
      }
    }
    return null;
  }
  if (isObject(actual) && isObject(expected)) {
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    for (const key of keys) {
      const m = findMismatch(actual[key], expected[key], `${path}.${key}`);
      if (m) {
        return m;
      }
    }
    return null;
  }
  return Object.is(actual, expected)
    ? null
    : `${path}: ${String(actual)} ≠ ${String(expected)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
