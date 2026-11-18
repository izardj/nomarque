import type { PlannedJob } from './reign-plan';

/**
 * Where delayed jobs are queued. The reign code only knows this port; BullMQ
 * is one adapter, tests use another.
 */
export abstract class JobScheduler {
  /**
   * Queues the job to run after `delayMs`. A job whose id is already queued is
   * left as it is.
   */
  abstract schedule(planned: PlannedJob, delayMs: number): Promise<void>;
}
