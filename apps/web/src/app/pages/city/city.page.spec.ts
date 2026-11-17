import { throwError } from 'rxjs';
import { GAME_DATA } from '@nomarque/data';
import { setupScreen } from '../../core/screen-testing';
import { NOME_STATE, nomeState } from '../../core/testing';
import { fr } from '../../i18n/fr';
import { CityPage } from './city.page';

function text(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function tiles(el: HTMLElement): HTMLButtonElement[] {
  return Array.from(el.querySelectorAll<HTMLButtonElement>('.grid .tile'));
}

/** Title and subtitle of a tile. */
function parts(tile: Element): string[] {
  return Array.from(tile.querySelectorAll('span')).map(text);
}

describe('CityPage', () => {
  it('lays the 16 parcels out in slot order, coloured by zone', async () => {
    const { el } = await setupScreen(CityPage);
    const all = tiles(el);

    expect(all.length).toBe(16);
    const zones = NOME_STATE.nome.parcels.map((parcel) => parcel.zone);
    expect(
      all.map((tile) =>
        zones.find((zone) => tile.classList.contains(`tile--${zone}`)),
      ),
    ).toEqual(zones);
  });

  it('counts the occupied parcels', async () => {
    const { el } = await setupScreen(CityPage);
    expect(text(el)).toContain('8 parcelles sur 16');
  });

  it('shows the building and its output on a tile', async () => {
    const { el } = await setupScreen(CityPage);
    expect(parts(tiles(el)[0])).toEqual(['Carrière de calcaire', 'calcaire']);
    expect(parts(tiles(el)[5])).toEqual(['Boulangerie', 'pain']);
    expect(parts(tiles(el)[8])).toEqual(['Champ de blé', 'blé']);
  });

  it('shows a block of houses with its count and level', async () => {
    const { el } = await setupScreen(CityPage);
    expect(parts(tiles(el)[4])).toEqual(['Huttes', '×3 · niv. 1']);
  });

  it('invites to build on an empty parcel', async () => {
    const { el } = await setupScreen(CityPage);
    expect(text(tiles(el)[2])).toBe('+ Construire');
  });

  it('shows the countdown of a construction site', async () => {
    const { el } = await setupScreen(CityPage);
    expect(text(tiles(el)[7])).toContain('Chantier · prêt dans 2 h 10');
  });

  it('highlights the range of a service with Chebyshev distance', async () => {
    const { el, fixture } = await setupScreen(CityPage);

    tiles(el)[6].click();
    fixture.detectChanges();

    const inRange = tiles(el)
      .map((tile, slot) => (tile.classList.contains('tile--range') ? slot : -1))
      .filter((slot) => slot >= 0);
    expect(inRange).toEqual([1, 2, 3, 5, 7, 9, 10, 11]);
    expect(tiles(el)[6].getAttribute('aria-pressed')).toBe('true');
    expect(text(el)).toContain('Portée : Puits');
  });

  it('shows the workers of a selected building', async () => {
    const { el, fixture } = await setupScreen(CityPage);

    tiles(el)[0].click();
    fixture.detectChanges();

    expect(text(el.querySelector('.panel') as Element)).toContain(
      '4 / 6 paysans',
    );
    expect(el.querySelector('.tile--range')).toBeNull();
  });

  it('closes the panel on a second tap', async () => {
    const { el, fixture } = await setupScreen(CityPage);

    tiles(el)[0].click();
    fixture.detectChanges();
    tiles(el)[0].click();
    fixture.detectChanges();

    expect(el.querySelector('.panel')).toBeNull();
  });

  it('lists what the zone allows on an empty parcel, houses included', async () => {
    const { el, fixture } = await setupScreen(CityPage);

    tiles(el)[2].click();
    fixture.detectChanges();

    const names = Array.from(el.querySelectorAll('.choice__name')).map(text);
    expect(names[0]).toBe('Îlot de maisons');
    expect(names.length).toBe(
      GAME_DATA.buildings.filter((def) => def.zones.includes('desert')).length +
        1,
    );
    expect(text(el.querySelector('.choice') as Element)).toContain(
      '30 deben · 4 h',
    );
  });

  it('disables a choice when the deben are missing', async () => {
    const poor = nomeState({ nome: { ...NOME_STATE.nome, deben: 20 } });
    const { el, fixture } = await setupScreen(CityPage, poor);

    tiles(el)[2].click();
    fixture.detectChanges();

    const choices = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.choice'),
    );
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.every((choice) => choice.disabled)).toBe(true);
    expect(text(choices[0])).toContain(fr.city.notEnoughDeben);
  });

  it('builds a block of houses', async () => {
    const { el, fixture, api, settle } = await setupScreen(CityPage);

    tiles(el)[2].click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.choice')?.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>(
      '.panel__actions .btn--primary',
    )?.click();
    await settle();

    expect(api.build).toHaveBeenCalledWith('w1', 2, { kind: 'houses' });
    expect(el.querySelector('.panel')).toBeNull();
  });

  it('builds the chosen building', async () => {
    const { el, fixture, api, settle } = await setupScreen(CityPage);

    tiles(el)[2].click();
    fixture.detectChanges();
    const quarry = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.choice'),
    ).find((choice) => text(choice).includes('Carrière de calcaire'));
    quarry?.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>(
      '.panel__actions .btn--primary',
    )?.click();
    await settle();

    expect(api.build).toHaveBeenCalledWith('w1', 2, {
      kind: 'building',
      building: 'limestone_quarry',
    });
  });

  it('does not build before a choice is made', async () => {
    const { el, fixture, api } = await setupScreen(CityPage);

    tiles(el)[2].click();
    fixture.detectChanges();

    const confirm = el.querySelector<HTMLButtonElement>(
      '.panel__actions .btn--primary',
    );
    expect(confirm?.disabled).toBe(true);
    expect(api.build).not.toHaveBeenCalled();
  });

  it('keeps the panel open when the server refuses', async () => {
    const { el, fixture, api, settle, store } = await setupScreen(CityPage);
    api.build.mockReturnValueOnce(
      throwError(() => ({
        statusCode: 422,
        code: 'not_enough_deben',
        message: 'refused',
      })),
    );

    tiles(el)[2].click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.choice')?.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>(
      '.panel__actions .btn--primary',
    )?.click();
    await settle();

    expect(el.querySelector('.panel')).not.toBeNull();
    expect(store.error()).toBe(fr.errors.not_enough_deben);
  });
});
