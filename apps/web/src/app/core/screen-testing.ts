import { signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { NomeStateResponse } from '@nomarque/contracts';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from './api.service';
import { Clock } from './clock';
import { NomeStore } from './nome.store';
import { NOME_STATE, TEST_NOW_MS } from './testing';

/**
 * Mounts a game screen on a store loaded with `state`. Every API action
 * answers `answer` (the state by default) and can be inspected on `api`.
 */
export async function setupScreen<T>(
  component: Type<T>,
  state: NomeStateResponse = NOME_STATE,
  answer: NomeStateResponse = state,
) {
  const api = {
    getNomeState: vi.fn(() => of(state)),
    build: vi.fn(() => of(answer)),
    assignWorkers: vi.fn(() => of(answer)),
    ackReport: vi.fn(() => of(answer)),
  };
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideRouter([]),
      NomeStore,
      { provide: ApiService, useValue: api },
      { provide: Clock, useValue: { now: signal(TEST_NOW_MS) } },
    ],
  });
  const store = TestBed.inject(NomeStore);
  await store.load('w1');
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  return { fixture, el, store, api, settle };
}
