import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import type {
  ApiErrorDto,
  BuildRequest,
  NomeStateResponse,
} from '@nomarque/contracts';
import { type Observable, firstValueFrom } from 'rxjs';
import { ApiService, isApiErrorDto, toApiError } from './api.service';
import { errorMessage } from './error-message';

/** Quiet time after the last tap on a worker stepper before the request. */
export const WORKERS_DEBOUNCE_MS = 400;

/**
 * The nome of the current world: the last state sent by the server. Every
 * action replaces the whole state with its answer, so the client never
 * computes the effect of an action itself.
 */
@Injectable()
export class NomeStore {
  private readonly api = inject(ApiService);
  private readonly stateSignal = signal<NomeStateResponse | null>(null);
  private readonly failure = signal<ApiErrorDto | null>(null);
  private readonly inFlight = signal(0);
  private readonly drafts = signal<Readonly<Record<number, number>>>({});
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private worldId: string | null = null;
  /** Actions run one after the other so answers never arrive out of order. */
  private queue: Promise<unknown> = Promise.resolve();

  readonly state = this.stateSignal.asReadonly();
  readonly nome = computed(() => this.stateSignal()?.nome ?? null);
  readonly report = computed(() => this.stateSignal()?.report ?? null);
  /** The last failure, kept to let the shell react to a missing nome. */
  readonly failureDto = this.failure.asReadonly();
  readonly error = computed(() => {
    const failure = this.failure();
    return failure === null ? null : errorMessage(failure);
  });
  /** True while a request is on its way. */
  readonly busy = computed(() => this.inFlight() > 0);
  /** Worker counts tapped by the player and not yet confirmed by the server. */
  readonly workerDrafts = this.drafts.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
      this.timers.clear();
    });
  }

  /** Loads the nome of a world, forgetting the one of another world. */
  load(worldId: string): Promise<boolean> {
    if (this.worldId !== worldId) {
      this.stateSignal.set(null);
      this.drafts.set({});
    }
    this.worldId = worldId;
    return this.run((id) => this.api.getNomeState(id));
  }

  build(slot: number, request: BuildRequest): Promise<boolean> {
    return this.run((id) => this.api.build(id, slot, request));
  }

  /** Marks the report as read. */
  ackReport(): Promise<boolean> {
    return this.run((id) => this.api.ackReport(id));
  }

  /**
   * Shows the new worker count at once and sends it once the player stops
   * tapping, so a burst of taps is one request.
   */
  setWorkers(slot: number, workers: number): void {
    this.drafts.update((drafts) => ({ ...drafts, [slot]: workers }));
    const pending = this.timers.get(slot);
    if (pending !== undefined) {
      clearTimeout(pending);
    }
    this.timers.set(
      slot,
      setTimeout(() => {
        this.timers.delete(slot);
        void this.sendWorkers(slot, workers);
      }, WORKERS_DEBOUNCE_MS),
    );
  }

  private async sendWorkers(slot: number, workers: number): Promise<void> {
    await this.run((id) => this.api.assignWorkers(id, slot, { workers }));
    const newerOnItsWay =
      this.timers.has(slot) || this.drafts()[slot] !== workers;
    if (!newerOnItsWay) {
      this.drafts.update((drafts) => {
        const others = { ...drafts };
        delete others[slot];
        return others;
      });
    }
  }

  private run(
    call: (worldId: string) => Observable<NomeStateResponse>,
  ): Promise<boolean> {
    const worldId = this.worldId;
    if (worldId === null) {
      return Promise.resolve(false);
    }
    const result = this.queue.then(async () => {
      this.inFlight.update((count) => count + 1);
      this.failure.set(null);
      try {
        this.stateSignal.set(await firstValueFrom(call(worldId)));
        return true;
      } catch (error: unknown) {
        this.failure.set(isApiErrorDto(error) ? error : toApiError(error));
        return false;
      } finally {
        this.inFlight.update((count) => count - 1);
      }
    });
    this.queue = result;
    return result;
  }
}
