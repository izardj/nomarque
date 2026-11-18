import { Module } from '@nestjs/common';
import { NomesRepository } from '@nomarque/nome-store';
import { BullJobScheduler } from './bull-job-scheduler';
import { JobScheduler } from './job-scheduler';
import { ReignProcessors } from './reign-processors.service';
import { ReignQueueConsumer } from './reign-queue-consumer';
import { ReignScheduleService } from './reign-schedule.service';

@Module({
  providers: [
    NomesRepository,
    ReignProcessors,
    ReignScheduleService,
    ReignQueueConsumer,
    { provide: JobScheduler, useClass: BullJobScheduler },
  ],
})
export class ReignModule {}
