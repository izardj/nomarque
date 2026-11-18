import { Global, Module } from '@nestjs/common';

/** The source of real time, replaceable in tests. */
export interface Clock {
  /** Epoch milliseconds. */
  now(): number;
}

export const CLOCK = Symbol('CLOCK');

@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: { now: () => Date.now() } }],
  exports: [CLOCK],
})
export class ClockModule {}
