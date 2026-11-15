import fc from 'fast-check';
import { gameHours, realInstantMs, toRealMs } from './time';

const HOUR = 3_600_000;
const start = Date.UTC(2026, 10, 16, 19, 0); // a Monday, 20:00 Paris time

describe('gameHours', () => {
  it('is zero at the reign start', () => {
    expect(gameHours({ startsAtMs: start, speed: 1 }, start)).toBe(0);
  });

  it('counts one game hour per real hour at speed 1', () => {
    expect(gameHours({ startsAtMs: start, speed: 1 }, start + 168 * HOUR)).toBe(
      168,
    );
  });

  it('fits a Nile year (168 game hours) in one real day at speed 7', () => {
    expect(gameHours({ startsAtMs: start, speed: 7 }, start + 24 * HOUR)).toBe(
      168,
    );
  });

  it('is negative before the start', () => {
    expect(gameHours({ startsAtMs: start, speed: 1 }, start - HOUR)).toBe(-1);
  });

  it('rejects a non-positive speed', () => {
    expect(() => gameHours({ startsAtMs: start, speed: 0 }, start)).toThrow(
      RangeError,
    );
  });
});

describe('toRealMs', () => {
  it('converts game hours to real milliseconds', () => {
    expect(toRealMs(168, 7)).toBe(24 * HOUR);
    expect(toRealMs(6, 1)).toBe(6 * HOUR);
  });

  it('is the inverse of gameHours', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 672, noNaN: true }),
        fc.constantFrom(1, 3, 4, 7),
        (hours, speed) => {
          const clock = { startsAtMs: start, speed };
          expect(gameHours(clock, realInstantMs(clock, hours))).toBeCloseTo(
            hours,
            6,
          );
        },
      ),
    );
  });
});
