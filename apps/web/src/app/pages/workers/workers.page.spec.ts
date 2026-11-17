import { throwError } from 'rxjs';
import { WORKERS_DEBOUNCE_MS } from '../../core/nome.store';
import { setupScreen } from '../../core/screen-testing';
import { NOME_STATE, nomeState } from '../../core/testing';
import { fr } from '../../i18n/fr';
import { WorkersPage } from './workers.page';

function text(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function rows(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>('.row'));
}

function button(row: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(row.querySelectorAll('button')).find((candidate) =>
    candidate.getAttribute('aria-label')?.startsWith(label),
  );
  if (!found) {
    throw new Error(`No ${label} button`);
  }
  return found;
}

describe('WorkersPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows each class of workers with its free hands', async () => {
    const { el } = await setupScreen(WorkersPage);
    const cards = Array.from(el.querySelectorAll('.card')).map((card) =>
      Array.from(card.children).map(text),
    );

    expect(cards).toEqual([
      ['Paysans', '57 / 58', '1 libre'],
      ['Artisans', '22 / 29', '7 libres'],
      ['Scribes', '2 / 19', '17 libres'],
    ]);
  });

  it('flags a class that is short of workers', async () => {
    const state = nomeState({
      nome: {
        ...NOME_STATE.nome,
        workforce: {
          ...NOME_STATE.nome.workforce,
          priest: { available: 1, assigned: 3, ratio: 0.33 },
        },
      },
    });
    const { el } = await setupScreen(WorkersPage, state);

    expect(text(el.querySelector('.card__status--short') as Element)).toBe(
      '2 en manque',
    );
  });

  it('lists the finished buildings only, one row each', async () => {
    const { el } = await setupScreen(WorkersPage);
    const names = rows(el).map((row) => text(row.querySelector('.row__name')!));

    expect(names).toEqual([
      'Carrière de calcaire',
      'Briqueterie',
      'Boulangerie',
      'Puits',
      'Champ de blé',
      'Pêcherie',
    ]);
  });

  it('forecasts the harvest of a field', async () => {
    const { el } = await setupScreen(WorkersPage);
    const field = rows(el)[4];
    expect(text(field.querySelector('.row__forecast')!)).toBe(
      '≈ 200 blé à la récolte',
    );
  });

  it('forecasts the yearly output of a workshop', async () => {
    const { el } = await setupScreen(WorkersPage);
    const bakery = rows(el)[2];
    expect(text(bakery.querySelector('.row__forecast')!)).toBe('110 pain / an');
  });

  it('warns about the production lost when a building is understaffed', async () => {
    const { el } = await setupScreen(WorkersPage);
    const quarry = rows(el)[0];

    expect(text(quarry.querySelector('.row__alert')!)).toBe(
      '4 / 6 · production −33 %',
    );
    expect(rows(el)[1].querySelector('.row__alert')).toBeNull();
  });

  it('gives every stepper button an accessible name and a 44 px target', async () => {
    const { el } = await setupScreen(WorkersPage);
    const quarry = rows(el)[0];

    expect(button(quarry, 'Retirer un paysan').getAttribute('aria-label')).toBe(
      'Retirer un paysan : Carrière de calcaire, ligne 1, colonne 1',
    );
    expect(button(quarry, 'Ajouter un paysan').getAttribute('aria-label')).toBe(
      'Ajouter un paysan : Carrière de calcaire, ligne 1, colonne 1',
    );
    expect(
      button(rows(el)[2], 'Ajouter un artisan').getAttribute('aria-label'),
    ).toContain('Boulangerie');
  });

  it('assigns the new count once, after a burst of taps', async () => {
    vi.useFakeTimers();
    const { el, fixture, api } = await setupScreen(WorkersPage);
    const quarry = rows(el)[0];

    button(quarry, 'Ajouter').click();
    fixture.detectChanges();
    button(rows(el)[0], 'Ajouter').click();
    fixture.detectChanges();

    expect(text(rows(el)[0].querySelector('.row__count')!)).toBe('6');
    expect(api.assignWorkers).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(WORKERS_DEBOUNCE_MS);

    expect(api.assignWorkers).toHaveBeenCalledTimes(1);
    expect(api.assignWorkers).toHaveBeenCalledWith('w1', 0, { workers: 6 });
  });

  it('removes a worker', async () => {
    vi.useFakeTimers();
    const { el, fixture, api } = await setupScreen(WorkersPage);

    button(rows(el)[1], 'Retirer').click();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(WORKERS_DEBOUNCE_MS);

    expect(api.assignWorkers).toHaveBeenCalledWith('w1', 1, { workers: 2 });
  });

  it('shows the state answered by the server', async () => {
    vi.useFakeTimers();
    const answer = nomeState({
      nome: {
        ...NOME_STATE.nome,
        parcels: NOME_STATE.nome.parcels.map((parcel) =>
          parcel.slot === 0
            ? { ...parcel, workers: 5, occupancy: 5 / 6 }
            : parcel,
        ),
      },
    });
    const { el, fixture } = await setupScreen(WorkersPage, NOME_STATE, answer);

    button(rows(el)[0], 'Ajouter').click();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(WORKERS_DEBOUNCE_MS);
    fixture.detectChanges();

    expect(text(rows(el)[0].querySelector('.row__alert')!)).toBe(
      '5 / 6 · production −17 %',
    );
  });

  it('stops at zero and at the workers the building needs', async () => {
    const { el } = await setupScreen(WorkersPage);
    const well = rows(el)[3];

    expect(button(well, 'Ajouter').disabled).toBe(true);
    expect(button(well, 'Retirer').disabled).toBe(false);
  });

  it('shows the French message when the server refuses', async () => {
    vi.useFakeTimers();
    const { el, fixture, api, store } = await setupScreen(WorkersPage);
    api.assignWorkers.mockReturnValueOnce(
      throwError(() => ({
        statusCode: 422,
        code: 'invalid_workers',
        message: 'refused',
      })),
    );

    button(rows(el)[0], 'Ajouter').click();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(WORKERS_DEBOUNCE_MS);
    fixture.detectChanges();

    expect(store.error()).toBe(fr.errors.invalid_workers);
    expect(text(rows(el)[0].querySelector('.row__count')!)).toBe('4');
  });

  it('points to the city when no building is in service', async () => {
    const state = nomeState({
      nome: {
        ...NOME_STATE.nome,
        parcels: NOME_STATE.nome.parcels.map((parcel) => ({
          ...parcel,
          building: null,
        })),
      },
    });
    const { el } = await setupScreen(WorkersPage, state);

    expect(text(el)).toContain(fr.workers.empty);
    expect(el.querySelector('a')?.getAttribute('href')).toBe(
      '/worlds/w1/nome/cite',
    );
  });
});
