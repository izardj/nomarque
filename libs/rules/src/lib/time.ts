// Game time. Every duration in the rules is expressed in game hours. Real time
// only enters through epoch milliseconds passed in by the caller, and leaves
// through toRealMs.

const MS_PER_REAL_HOUR = 3_600_000;

export interface ReignClock {
  /** Reign start, epoch milliseconds. */
  startsAtMs: number;
  /** Server speed: one real hour lasts `speed` game hours. */
  speed: number;
}

/**
 * Game hours elapsed since the reign started at the real instant `nowMs`.
 * Negative before the start.
 */
export function gameHours(clock: ReignClock, nowMs: number): number {
  assertSpeed(clock.speed);
  return ((nowMs - clock.startsAtMs) / MS_PER_REAL_HOUR) * clock.speed;
}

/** Converts a game-hour duration into real milliseconds at the given speed. */
export function toRealMs(gameHoursDuration: number, speed: number): number {
  assertSpeed(speed);
  return (gameHoursDuration / speed) * MS_PER_REAL_HOUR;
}

/** Real epoch milliseconds at which the game-hour instant `hours` happens. */
export function realInstantMs(clock: ReignClock, hours: number): number {
  return clock.startsAtMs + toRealMs(hours, clock.speed);
}

function assertSpeed(speed: number): void {
  if (!(speed > 0) || !Number.isFinite(speed)) {
    throw new RangeError(
      `speed must be a positive finite number, got ${speed}`,
    );
  }
}
