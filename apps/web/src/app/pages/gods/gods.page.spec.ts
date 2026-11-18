import { setupScreen } from '../../core/screen-testing';
import { NOME_STATE, withNome } from '../../core/testing';
import { GodsPage } from './gods.page';

function text(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function gods(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>('.god'));
}

function offerButton(god: HTMLElement): HTMLButtonElement {
  return god.querySelector<HTMLButtonElement>(
    'button.offer',
  ) as HTMLButtonElement;
}

describe('GodsPage', () => {
  it('shows the Nile panel above the gods', async () => {
    const { el } = await setupScreen(GodsPage);
    const nile = text(el.querySelector('.nile')!);

    expect(nile).toContain('Année 1 du règne · Peret');
    expect(nile).toContain('Crue de cette année : bonne');
    expect(nile).toContain('Cultures verrouillées');
  });

  it('announces the next flood only when it is known', async () => {
    const known = withNome({
      nile: { ...NOME_STATE.nome.nile, nextFlood: 'high' },
    });
    const { el } = await setupScreen(GodsPage, known);
    expect(text(el.querySelector('.nile')!)).toContain(
      "Crue annoncée pour l'an prochain : haute",
    );
  });

  it('shows the time left to change crops during Akhet', async () => {
    const akhet = withNome({
      nile: {
        ...NOME_STATE.nome.nile,
        phase: 'akhet',
        cropsLocked: false,
        nextPhase: 'peret',
        nextPhaseAtIso: '2026-11-17T13:00:00.000Z',
      },
    });
    const { el } = await setupScreen(GodsPage, akhet);
    expect(text(el.querySelector('.nile')!)).toContain(
      'Cultures modifiables encore 3 h.',
    );
  });

  it('lists the five gods with their domain and standing', async () => {
    const { el } = await setupScreen(GodsPage);

    const parts = (god: HTMLElement) =>
      ['.god__name', '.god__domain', '.god__standing'].map((selector) =>
        text(god.querySelector(selector)!),
      );
    expect(gods(el).map(parts)).toEqual([
      ['Hâpy', 'La crue', 'Bénédiction'],
      ['Osiris', 'Les récoltes', 'Neutre'],
      ['Thot', 'Le savoir', 'Négligé'],
      ['Bastet', 'Le foyer', 'Courroucé'],
      ['Sekhmet', 'La santé', 'Neutre'],
    ]);
  });

  it('exposes each favour gauge with its values and two threshold markers', async () => {
    const { el } = await setupScreen(GodsPage);
    const gauge = gods(el)[0].querySelector('.gauge') as HTMLElement;

    expect(gauge.getAttribute('role')).toBe('meter');
    expect(gauge.getAttribute('aria-valuemin')).toBe('0');
    expect(gauge.getAttribute('aria-valuemax')).toBe('100');
    expect(gauge.getAttribute('aria-valuenow')).toBe('82');
    expect(gauge.getAttribute('aria-label')).toBe('Faveur de Hâpy');
    expect(gauge.querySelectorAll('.gauge__mark').length).toBe(2);
    expect(
      (gauge.querySelector('.gauge__fill') as HTMLElement).style.width,
    ).toBe('82%');
  });

  it('enables the offering of a god the stock can pay', async () => {
    const { el } = await setupScreen(GodsPage);
    const hapy = gods(el)[0];

    expect(text(offerButton(hapy))).toBe('Offrir 20 blé (+10)');
    expect(offerButton(hapy).disabled).toBe(false);
    expect(hapy.querySelector('.god__reason')).toBeNull();
  });

  it('disables the offering with the missing resource when the stock is short', async () => {
    const { el } = await setupScreen(GodsPage);
    const bastet = gods(el)[3];

    expect(offerButton(bastet).disabled).toBe(true);
    expect(text(bastet.querySelector('.god__reason')!)).toBe(
      'Pas assez de poisson',
    );
  });

  it('disables every offering with a countdown while the next one is not open', async () => {
    const waiting = withNome({
      nextOfferingAt: 130,
      nextOfferingAtIso: '2026-11-17T15:30:00.000Z',
    });
    const { el } = await setupScreen(GodsPage, waiting);

    for (const god of gods(el)) {
      expect(offerButton(god).disabled).toBe(true);
      expect(text(god.querySelector('.god__reason')!)).toBe(
        'Prochaine offrande dans 5 h 30',
      );
    }
  });

  it('sends the god of the offering', async () => {
    const { el, api, settle } = await setupScreen(GodsPage);

    offerButton(gods(el)[1]).click();
    await settle();

    expect(api.makeOffering).toHaveBeenCalledWith('w1', { god: 'osiris' });
  });

  it('gives the offering buttons an accessible name with the god', async () => {
    const { el } = await setupScreen(GodsPage);
    expect(offerButton(gods(el)[0]).getAttribute('aria-label')).toBe(
      'Offrir 20 blé (+10), Hâpy',
    );
  });

  it('disables the offerings once the reign is over', async () => {
    const over = withNome({
      reign: { ...NOME_STATE.nome.reign, over: true },
    });
    const { el } = await setupScreen(GodsPage, over);
    expect(gods(el).every((god) => offerButton(god).disabled)).toBe(true);
  });

  it('says when no lasting effect is active', async () => {
    const { el } = await setupScreen(GodsPage);
    expect(text(el)).toContain('Aucun effet en cours.');
  });

  it('lists the lasting effects with their end time', async () => {
    const state = withNome({
      modifiers: [
        {
          effect: { kind: 'houseUpgrade', mode: 'fast', hours: 24 },
          startsAt: 100,
          endsAt: 120,
          endsAtIso: '2026-11-17T11:30:00.000Z',
        },
      ],
    });
    const { el } = await setupScreen(GodsPage, state);

    const modifier = el.querySelector('.modifier') as HTMLElement;
    expect(text(modifier.children[0])).toBe(
      'Montée de niveau des maisons accélérée',
    );
    expect(text(modifier.children[1])).toBe('encore 1 h 30');
  });
});
