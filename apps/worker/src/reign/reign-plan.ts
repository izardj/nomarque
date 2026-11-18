import { GAME_DATA } from '@nomarque/data';
import {
  NILE_CALENDAR,
  REIGN_YEARS,
  realInstantMs,
  type ReignClock,
} from '@nomarque/rules';

/**
 * Game hours of funerals at the end of the last Nile year (game design, "Fin
 * de règne": hours 144 to 168 of year 4). The rules library has no name for
 * it, so the start of the funerals is derived as the end of the year minus
 * this duration.
 */
export const FUNERALS_HOURS = 24;

export type PhaseName = 'akhet' | 'peret' | 'shemu' | 'funerals';

export type ReignJob =
  | { name: 'reign.start'; reignId: string }
  | { name: 'nile.phase'; reignId: string; year: number; phase: PhaseName }
  | { name: 'reign.end'; reignId: string };

export interface PlannedJob {
  job: ReignJob;
  /** BullMQ job id: the idempotence key of the job. */
  jobId: string;
  /** Real instant at which the job is due, epoch milliseconds. */
  dueMs: number;
}

/**
 * BullMQ refuses ":" in custom job ids, so ids join their parts with "_".
 * Reign ids are UUIDs and phases are plain words: no part holds a "_".
 */
export function jobIdOf(job: ReignJob): string {
  switch (job.name) {
    case 'reign.start':
    case 'reign.end':
      return `${job.name}_${job.reignId}`;
    case 'nile.phase':
      return `${job.name}_${job.reignId}_${job.year}_${job.phase}`;
  }
}

/** Game hour of the Nile year `year` at which the phase starts. */
export function phaseStartHour(year: number, phase: PhaseName): number {
  const { yearHours } = GAME_DATA.parameters;
  const yearStart = year * yearHours;
  switch (phase) {
    case 'akhet':
      return yearStart;
    case 'peret':
      return yearStart + NILE_CALENDAR.akhetEndsAt;
    case 'shemu':
      return yearStart + NILE_CALENDAR.peretEndsAt;
    case 'funerals':
      return yearStart + yearHours - FUNERALS_HOURS;
  }
}

/**
 * Every job of a reign in chronological order: its start, each phase
 * boundary, its end. Phases starting at hour 0 of year 0 share the instant of
 * the start and come right after it.
 */
export function planReign(
  reign: { id: string; startsAt: Date; endsAt: Date },
  speed: number,
): PlannedJob[] {
  const clock: ReignClock = { startsAtMs: reign.startsAt.getTime(), speed };
  const planned: PlannedJob[] = [
    plan({ name: 'reign.start', reignId: reign.id }, reign.startsAt.getTime()),
  ];
  for (let year = 0; year < REIGN_YEARS; year++) {
    const phases: PhaseName[] = ['akhet', 'peret', 'shemu'];
    if (year === REIGN_YEARS - 1) {
      phases.push('funerals');
    }
    for (const phase of phases) {
      planned.push(
        plan(
          { name: 'nile.phase', reignId: reign.id, year, phase },
          realInstantMs(clock, phaseStartHour(year, phase)),
        ),
      );
    }
  }
  planned.push(
    plan({ name: 'reign.end', reignId: reign.id }, reign.endsAt.getTime()),
  );
  return planned;
}

function plan(job: ReignJob, dueMs: number): PlannedJob {
  return { job, jobId: jobIdOf(job), dueMs };
}
