import { TestBed } from '@angular/core/testing';
import type { NomeStateResponse } from '@nomarque/contracts';
import { type Observable, Subject, of, throwError } from 'rxjs';
import { fr } from '../i18n/fr';
import { ApiService } from './api.service';
import { NomeStore, WORKERS_DEBOUNCE_MS } from './nome.store';
import { NOME_STATE, nomeState } from './testing';

type Calls = Partial<{
  getNomeState: () => Observable<NomeStateResponse>;
  build: () => Observable<NomeStateResponse>;
  assignWorkers: () => Observable<NomeStateResponse>;
  ackReport: () => Observable<NomeStateResponse>;
}>;

function setup(calls: Calls = {}) {
  const api = {
    getNomeState: vi.fn(calls.getNomeState ?? (() => of(NOME_STATE))),
    build: vi.fn(calls.build ?? (() => of(NOME_STATE))),
    assignWorkers: vi.fn(calls.assignWorkers ?? (() => of(NOME_STATE))),
    ackReport: vi.fn(calls.ackReport ?? (() => of(NOME_STATE))),
  };
  TestBed.configureTestingModule({
    providers: [NomeStore, { provide: ApiService, useValue: api }],
  });
  return { store: TestBed.inject(NomeStore), api };
}

const refused = {
  statusCode: 422,
  code: 'not_enough_deben',
  message: 'refused',
};

describe('NomeStore', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts empty', () => {
    const { store } = setup();
    expect(store.state()).toBeNull();
    expect(store.nome()).toBeNull();
    expect(store.error()).toBeNull();
  });

  it('keeps the state answered by the server', async () => {
    const { store, api } = setup();

    expect(await store.load('w1')).toBe(true);

    expect(api.getNomeState).toHaveBeenCalledWith('w1');
    expect(store.state()).toEqual(NOME_STATE);
    expect(store.nome()?.name).toBe('Nome du Faucon');
    expect(store.report()).toEqual(NOME_STATE.report);
  });

  it('translates a failed load and keeps the failure', async () => {
    const { store } = setup({
      getNomeState: () =>
        throwError(() => ({
          statusCode: 0,
          code: 'network_error',
          message: '',
        })),
    });

    expect(await store.load('w1')).toBe(false);

    expect(store.error()).toBe(fr.errors.network_error);
    expect(store.failureDto()?.code).toBe('network_error');
    expect(store.state()).toBeNull();
  });

  it('replaces the state with the answer of a build', async () => {
    const built = nomeState({
      nome: { ...NOME_STATE.nome, deben: 1000 },
    });
    const { store, api } = setup({ build: () => of(built) });
    await store.load('w1');

    const ok = await store.build(2, { kind: 'building', building: 'bakery' });

    expect(ok).toBe(true);
    expect(api.build).toHaveBeenCalledWith('w1', 2, {
      kind: 'building',
      building: 'bakery',
    });
    expect(store.nome()?.deben).toBe(1000);
  });

  it('keeps the state and shows the French message of a refused action', async () => {
    const { store } = setup({ build: () => throwError(() => refused) });
    await store.load('w1');

    const ok = await store.build(2, { kind: 'houses' });

    expect(ok).toBe(false);
    expect(store.state()).toEqual(NOME_STATE);
    expect(store.error()).toBe(fr.errors.not_enough_deben);
  });

  it('clears the previous error when the next action starts', async () => {
    const { store } = setup({ build: () => throwError(() => refused) });
    await store.load('w1');
    await store.build(2, { kind: 'houses' });

    await store.ackReport();

    expect(store.error()).toBeNull();
  });

  it('acknowledges the report and takes the new state', async () => {
    const acked = nomeState({ report: { ...NOME_STATE.report, taxes: 0 } });
    const { store, api } = setup({ ackReport: () => of(acked) });
    await store.load('w1');

    await store.ackReport();

    expect(api.ackReport).toHaveBeenCalledWith('w1');
    expect(store.report()?.taxes).toBe(0);
  });

  it('does nothing before a world is loaded', async () => {
    const { store, api } = setup();
    expect(await store.ackReport()).toBe(false);
    expect(api.ackReport).not.toHaveBeenCalled();
  });

  it('forgets the nome of another world', async () => {
    const pending = new Subject<NomeStateResponse>();
    const { store, api } = setup();
    await store.load('w1');
    api.getNomeState.mockReturnValueOnce(pending);

    void store.load('w2');

    expect(store.state()).toBeNull();
  });

  it('runs actions one after the other', async () => {
    const first = new Subject<NomeStateResponse>();
    const { store, api } = setup({ build: () => first });
    await store.load('w1');
    api.ackReport.mockClear();

    const built = store.build(2, { kind: 'houses' });
    const acked = store.ackReport();
    await Promise.resolve();
    expect(api.ackReport).not.toHaveBeenCalled();
    expect(store.busy()).toBe(true);

    first.next(NOME_STATE);
    first.complete();
    await built;
    await acked;

    expect(api.ackReport).toHaveBeenCalledTimes(1);
    expect(store.busy()).toBe(false);
  });

  describe('worker changes', () => {
    it('shows a tapped count at once and sends one request after a pause', async () => {
      vi.useFakeTimers();
      const { store, api } = setup();
      await store.load('w1');

      store.setWorkers(8, 9);
      store.setWorkers(8, 10);
      store.setWorkers(8, 11);

      expect(store.workerDrafts()[8]).toBe(11);
      expect(api.assignWorkers).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(WORKERS_DEBOUNCE_MS);

      expect(api.assignWorkers).toHaveBeenCalledTimes(1);
      expect(api.assignWorkers).toHaveBeenCalledWith('w1', 8, { workers: 11 });
      expect(store.workerDrafts()[8]).toBeUndefined();
    });

    it('drops the draft when the server refuses', async () => {
      vi.useFakeTimers();
      const { store } = setup({
        assignWorkers: () =>
          throwError(() => ({ ...refused, code: 'invalid_workers' })),
      });
      await store.load('w1');

      store.setWorkers(8, 99);
      await vi.advanceTimersByTimeAsync(WORKERS_DEBOUNCE_MS);

      expect(store.workerDrafts()[8]).toBeUndefined();
      expect(store.error()).toBe(fr.errors.invalid_workers);
    });

    it('keeps a count tapped while the previous request is in flight', async () => {
      vi.useFakeTimers();
      const inFlight = new Subject<NomeStateResponse>();
      const { store, api } = setup();
      await store.load('w1');
      api.assignWorkers.mockReturnValueOnce(inFlight);

      store.setWorkers(8, 9);
      await vi.advanceTimersByTimeAsync(WORKERS_DEBOUNCE_MS);
      store.setWorkers(8, 10);
      inFlight.next(NOME_STATE);
      inFlight.complete();
      await vi.advanceTimersByTimeAsync(0);

      expect(store.workerDrafts()[8]).toBe(10);

      await vi.advanceTimersByTimeAsync(WORKERS_DEBOUNCE_MS);

      expect(api.assignWorkers).toHaveBeenLastCalledWith('w1', 8, {
        workers: 10,
      });
      expect(store.workerDrafts()[8]).toBeUndefined();
    });
  });
});
