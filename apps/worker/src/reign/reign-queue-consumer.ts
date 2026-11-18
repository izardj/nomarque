import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { ENV, type Env } from '../config/env';
import { REIGN_QUEUE } from './bull-job-scheduler';
import { jobIdOf, type ReignJob } from './reign-plan';
import { ReignScheduleService } from './reign-schedule.service';

/** Consumes the `reign` queue, after rebuilding it from the database. */
@Injectable()
export class ReignQueueConsumer
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ReignQueueConsumer.name);
  private worker: Worker<ReignJob> | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly schedule: ReignScheduleService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.worker = new Worker<ReignJob>(
      REIGN_QUEUE,
      (queued: Job<ReignJob>) =>
        this.schedule.run({ job: queued.data, jobId: jobIdOf(queued.data) }),
      { connection: { url: this.env.REDIS_URL } },
    );
    this.worker.on('failed', (queued, error) => {
      this.logger.error(`job ${queued?.id} failed: ${error.message}`);
    });
    await this.schedule.reconcile();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}
