import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLOCK, type Clock } from '../common/clock';
import { PrismaService } from '../prisma/prisma.service';
import { JobScheduler } from './job-scheduler';
import { ReignProcessors } from './reign-processors.service';
import { planReign, type PlannedJob, type ReignJob } from './reign-plan';

/** Queues the jobs of the reigns and runs those whose time has passed. */
@Injectable()
export class ReignScheduleService {
  private readonly logger = new Logger(ReignScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly processors: ReignProcessors,
    private readonly scheduler: JobScheduler,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Startup reconciliation: the database says which reigns are not over, so
   * the queue can be rebuilt from it after a restart or a loss of Redis.
   */
  async reconcile(): Promise<void> {
    const reigns = await this.prisma.client.reign.findMany({
      where: { status: { not: 'ENDED' } },
      orderBy: [{ worldId: 'asc' }, { number: 'asc' }],
    });
    for (const reign of reigns) {
      await this.scheduleReign(reign.id);
    }
  }

  /**
   * Queues the jobs of the reign still in the future and runs, in order, the
   * overdue ones. An overdue end creates the next reign, scheduled in turn.
   */
  async scheduleReign(reignId: string): Promise<void> {
    const reign = await this.prisma.client.reign.findUniqueOrThrow({
      where: { id: reignId },
      include: { world: true },
    });
    if (reign.status === 'ENDED') {
      return;
    }
    for (const planned of planReign(reign, reign.world.speed)) {
      const delayMs = planned.dueMs - this.clock.now();
      if (delayMs > 0) {
        await this.scheduler.schedule(planned, delayMs);
        this.logger.log(
          `scheduled ${planned.jobId} in ${Math.round(delayMs / 1000)} s`,
        );
      } else {
        await this.run(planned);
      }
    }
  }

  /** Runs one job and queues what it created: the entry point of the queue. */
  async run({ job, jobId }: Pick<PlannedJob, 'job' | 'jobId'>): Promise<void> {
    this.logger.log(`running ${jobId}`);
    const next = await this.dispatch(job);
    if (next) {
      await this.scheduleReign(next);
    }
  }

  /** Returns the id of the reign the job created, if any. */
  private async dispatch(job: ReignJob): Promise<string | null> {
    switch (job.name) {
      case 'reign.start':
        await this.processors.start(job.reignId);
        return null;
      case 'nile.phase':
        await this.processors.phase(job.reignId, job.year, job.phase);
        return null;
      case 'reign.end':
        return (await this.processors.end(job.reignId))?.id ?? null;
    }
  }
}
