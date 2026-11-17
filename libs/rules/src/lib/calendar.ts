// The Nile calendar. These hours are fixed by the technical spec ("Le temps du
// jeu", "L'algorithme advance", "Les maisons"), not by the economy spreadsheet,
// and assume a Nile year of 168 game hours.

export const NILE_CALENDAR = {
  /** Akhet (flood) runs from hour 0 to this hour of the year. */
  akhetEndsAt: 48,
  /** Peret (sowing) runs from akhetEndsAt to this hour; Shemu follows. */
  peretEndsAt: 120,
  /** Fields are harvested at this hour of the year. */
  harvestAt: 120,
  /** The pharaoh's tribute is levied at this hour of the year. */
  tributeAt: 166,
} as const;

/** Fixed grid on which houses are evaluated, so results ignore login times. */
export const SEGMENT_HOURS = 6;

export const HOUSE_RULES = {
  /** All needs met this long, and the next level reachable: level up. */
  upgradeAfterHours: 24,
  /** A need missing this long: warning. */
  warnAfterHours: 24,
  /** A need missing this long: level down. */
  downgradeAfterHours: 48,
} as const;

export type NilePhase = 'akhet' | 'peret' | 'shemu';

export interface PhaseInfo {
  /** Zero-based Nile year of the reign. */
  year: number;
  phase: NilePhase;
  /** Position in the year, in [0, yearHours). */
  hourOfYear: number;
}

/** Year, phase and position in the year at the game-hour instant `hours`. */
export function phaseAt(hours: number, yearHours: number): PhaseInfo {
  assertYearHours(yearHours);
  const year = Math.floor(hours / yearHours);
  const hourOfYear = hours - year * yearHours;
  return { year, phase: phaseOfHour(hourOfYear), hourOfYear };
}

export interface PhaseBoundary {
  /** Game-hour instant of the boundary, strictly after the given instant. */
  at: number;
  /** Phase that starts at the boundary. */
  phase: NilePhase;
  year: number;
}

/** The first phase boundary strictly after `hours`. */
export function nextBoundary(hours: number, yearHours: number): PhaseBoundary {
  const { year, hourOfYear } = phaseAt(hours, yearHours);
  const yearStart = year * yearHours;
  if (hourOfYear < NILE_CALENDAR.akhetEndsAt) {
    return {
      at: yearStart + NILE_CALENDAR.akhetEndsAt,
      phase: 'peret',
      year,
    };
  }
  if (hourOfYear < NILE_CALENDAR.peretEndsAt) {
    return {
      at: yearStart + NILE_CALENDAR.peretEndsAt,
      phase: 'shemu',
      year,
    };
  }
  return { at: yearStart + yearHours, phase: 'akhet', year: year + 1 };
}

/** First instant strictly after `hours` whose hour of the year is `hourOfYear`. */
export function nextHourOfYear(
  hours: number,
  hourOfYear: number,
  yearHours: number,
): number {
  const year = Math.floor(hours / yearHours);
  const candidate = year * yearHours + hourOfYear;
  return candidate > hours ? candidate : candidate + yearHours;
}

/** First grid instant strictly after `hours`. */
export function nextGridPoint(hours: number): number {
  return (Math.floor(hours / SEGMENT_HOURS) + 1) * SEGMENT_HOURS;
}

export function isGridPoint(hours: number): boolean {
  return hours % SEGMENT_HOURS === 0;
}

function phaseOfHour(hourOfYear: number): NilePhase {
  if (hourOfYear < NILE_CALENDAR.akhetEndsAt) {
    return 'akhet';
  }
  if (hourOfYear < NILE_CALENDAR.peretEndsAt) {
    return 'peret';
  }
  return 'shemu';
}

function assertYearHours(yearHours: number): void {
  if (!(yearHours > NILE_CALENDAR.tributeAt)) {
    throw new RangeError(
      `yearHours must exceed the tribute hour (${NILE_CALENDAR.tributeAt}), got ${yearHours}`,
    );
  }
}
