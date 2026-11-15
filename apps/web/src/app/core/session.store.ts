import { Injectable, computed, inject, signal } from '@angular/core';
import type { MeResponse } from '@nomarque/contracts';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ApiService } from './api.service';

/** Who is logged in. `me` is null when logged out. */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly api = inject(ApiService);
  private readonly meState = signal<MeResponse | null>(null);

  readonly me = this.meState.asReadonly();
  readonly isLoggedIn = computed(() => this.meState() !== null);

  /** Loads the session from the server; any failure means logged out. */
  async load(): Promise<void> {
    const me = await firstValueFrom(
      this.api.me().pipe(catchError(() => of(null))),
    );
    this.meState.set(me);
  }

  setMe(me: MeResponse): void {
    this.meState.set(me);
  }

  /** Ends the session; the local state is cleared even if the call fails. */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } catch {
      // The cookie may already be gone: being logged out locally is enough.
    } finally {
      this.meState.set(null);
    }
  }
}
