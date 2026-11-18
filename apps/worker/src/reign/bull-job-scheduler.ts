import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ENV, type Env } from '../config/env';
import { JobScheduler } from './job-scheduler';
import type { PlannedJob } from './reign-plan';

export const REIGN_QUEUE = 'reign';

/** A failed job is retried this many times, waiting longer each time. */
const JOB_ATTEMPTS = 5;
const RETRY_BACKOFF_MS = 5_000;

/** The BullMQ adapter of the port: puts the delayed jobs in the `reign` queue. */
@Injectable()
export class BullJobScheduler implements JobScheduler, OnApplicationShutdown {
  private readonly queue: Queue;

  constructor(@Inject(ENV) env: Env) {
    this.queue = new Queue(REIGN_QUEUE, { connection: { url: env.REDIS_URL } });
  }

  async schedule({ job, jobId }: PlannedJob, delayMs: number): Promise<void> {
    await this.queue.add(job.name, job, {
      jobId,
      delay: delayMs,
      attempts: JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: RETRY_BACKOFF_MS },
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
