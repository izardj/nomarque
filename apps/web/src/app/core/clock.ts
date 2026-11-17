import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** How often countdowns are refreshed. */
export const CLOCK_TICK_MS = 30_000;

/** The browser clock as a signal, so countdowns update on their own. */
@Injectable({ providedIn: 'root' })
export class Clock {
  private readonly nowMs = signal(Date.now());

  /** Milliseconds since the epoch, refreshed every {@link CLOCK_TICK_MS}. */
  readonly now = this.nowMs.asReadonly();

  constructor() {
    const timer = setInterval(() => this.nowMs.set(Date.now()), CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
