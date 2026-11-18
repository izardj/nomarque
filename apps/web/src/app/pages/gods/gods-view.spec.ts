import { GAME_DATA } from '@nomarque/data';
import { NOME_STATE, TEST_NOW_MS, withNome } from '../../core/testing';
import {
  describeModifier,
  gaugeView,
  godViews,
  modifierViews,
  nileView,
  offeringView,
} from './gods-view';

const { godFavorMax, godFavorLow, godFavorBlessing } = GAME_DATA.parameters;
const NOME = NOME_STATE.nome;

describe('gaugeView', () => {
  it('fills the gauge in proportion of the maximum', () => {
    expect(gaugeView(godFavorMax / 2).percent).toBe(50);
    expect(gaugeView(godFavorMax * 2).percent).toBe(100);
    expect(gaugeView(-4).percent).toBe(0);
  });

  it('puts the markers at the low and blessing thresholds', () => {
    const gauge = gaugeView(10);
    expect(gauge.lowAt).toBe((godFavorLow / godFavorMax) * 100);
    expect(gauge.blessingAt).toBe((godFavorBlessing / godFavorMax) * 100);
    expect(gauge.max).toBe(godFavorMax);
  });

  it('rounds the value read by assistive technologies', () => {
    expect(gaugeView(41.6).value).toBe(42);
  });
});

describe('godViews', () => {
  it('lists the five gods with their French name, domain and standing', () => {
    const views = godViews(NOME, TEST_NOW_MS);

    expect(
      views.map((view) => [view.name, view.domain, view.standingLabel]),
    ).toEqual([
      ['Hâpy', 'La crue', 'Bénédiction'],
      ['Osiris', 'Les récoltes', 'Neutre'],
      ['Thot', 'Le savoir', 'Négligé'],
      ['Bastet', 'Le foyer', 'Courroucé'],
      ['Sekhmet', 'La santé', 'Neutre'],
    ]);
  });
});

describe('offeringView', () => {
  it('words the offering from the cost and the favour of the game data', () => {
    expect(offeringView(NOME, 'hapy', TEST_NOW_MS).label).toBe(
      'Offrir 20 blé (+10)',
    );
    expect(offeringView(NOME, 'thoth', TEST_NOW_MS).label).toBe(
      'Offrir 10 pain (+10)',
    );
  });

  it('is open when the stock covers the cost and no delay is running', () => {
    expect(offeringView(NOME, 'hapy', TEST_NOW_MS)).toMatchObject({
      disabled: false,
      reason: null,
    });
  });

  it('is closed with the missing resource when the stock is short', () => {
    expect(offeringView(NOME, 'bastet', TEST_NOW_MS)).toMatchObject({
      disabled: true,
      reason: 'Pas assez de poisson',
    });
  });

  it('is closed with a countdown while the next offering is in the future', () => {
    const waiting = withNome({
      nextOfferingAt: 130,
      nextOfferingAtIso: '2026-11-17T15:30:00.000Z',
    }).nome;

    expect(offeringView(waiting, 'hapy', TEST_NOW_MS)).toMatchObject({
      disabled: true,
      reason: 'Prochaine offrande dans 5 h 30',
    });
  });

  it('is open again once the date of the next offering is past', () => {
    const past = withNome({
      nextOfferingAt: 100,
      nextOfferingAtIso: '2026-11-17T09:00:00.000Z',
    }).nome;
    expect(offeringView(past, 'hapy', TEST_NOW_MS).disabled).toBe(false);
  });

  it('is closed without reason when the reign is over', () => {
    const over = withNome({ reign: { ...NOME.reign, over: true } }).nome;
    expect(offeringView(over, 'hapy', TEST_NOW_MS)).toMatchObject({
      disabled: true,
      reason: null,
    });
  });

  it('names the god for assistive technologies', () => {
    expect(offeringView(NOME, 'hapy', TEST_NOW_MS).ariaLabel).toBe(
      'Offrir 20 blé (+10), Hâpy',
    );
  });
});

describe('nileView', () => {
  it('tells the year, the phase and the flood', () => {
    const view = nileView(NOME.nile, TEST_NOW_MS);

    expect(view.yearAndPhase).toBe('Année 1 du règne · Peret');
    expect(view.flood).toBe('Crue de cette année : bonne');
    expect(view.nextFlood).toBeNull();
  });

  it('announces the next flood once it is known', () => {
    const view = nileView({ ...NOME.nile, nextFlood: 'low' }, TEST_NOW_MS);
    expect(view.nextFlood).toBe("Crue annoncée pour l'an prochain : basse");
  });

  it('says the crops are locked', () => {
    expect(nileView(NOME.nile, TEST_NOW_MS).crops).toContain('verrouillées');
  });

  it('counts down the time left to change crops during Akhet', () => {
    const akhet = {
      ...NOME.nile,
      phase: 'akhet' as const,
      cropsLocked: false,
      nextPhase: 'peret' as const,
      nextPhaseAtIso: '2026-11-17T13:00:00.000Z',
    };
    expect(nileView(akhet, TEST_NOW_MS).crops).toBe(
      'Cultures modifiables encore 3 h.',
    );
  });
});

describe('describeModifier', () => {
  it('words a temporary change of the workforce', () => {
    expect(
      describeModifier({
        kind: 'workforce',
        workerClass: 'peasant',
        change: { percent: -20 },
        hours: 24,
      }),
    ).toBe('Paysans −20 %');
    expect(
      describeModifier({
        kind: 'workforce',
        workerClass: 'scribe',
        change: { count: -2 },
        hours: 24,
      }),
    ).toBe('Scribes −2');
    expect(
      describeModifier({
        kind: 'workforce',
        workerClass: 'all',
        change: { percent: -10 },
        hours: 24,
      }),
    ).toBe('Production −10 %');
  });

  it('words a building or the fields at a standstill', () => {
    expect(
      describeModifier({
        kind: 'idle',
        target: { kind: 'building', building: 'granary' },
        percent: -100,
        hours: 6,
      }),
    ).toBe("Grenier à l'arrêt");
    expect(
      describeModifier({
        kind: 'idle',
        target: { kind: 'fields' },
        percent: -50,
        hours: 12,
      }),
    ).toBe('Ouvriers des champs −50 %');
  });

  it('words a production bonus and a consumption change', () => {
    expect(
      describeModifier({
        kind: 'production',
        resource: 'pottery',
        percent: 20,
        hours: 'year',
        startsAfter: 0,
      }),
    ).toBe('Production de poterie +20 %');
    expect(
      describeModifier({
        kind: 'consumption',
        resource: 'wheat',
        percent: -20,
        hours: 48,
      }),
    ).toBe('Consommation de blé −20 %');
  });

  it('words the pace of the house upgrades', () => {
    expect(
      describeModifier({ kind: 'houseUpgrade', mode: 'blocked', hours: 24 }),
    ).toBe('Montée de niveau des maisons bloquée');
    expect(
      describeModifier({ kind: 'houseUpgrade', mode: 'fast', hours: 24 }),
    ).toBe('Montée de niveau des maisons accélérée');
  });
});

describe('modifierViews', () => {
  const effect = {
    kind: 'houseUpgrade',
    mode: 'blocked',
    hours: 24,
  } as const;

  it('shows the time left of an active effect', () => {
    const nome = withNome({
      modifiers: [
        {
          effect,
          startsAt: 100,
          endsAt: 120,
          endsAtIso: '2026-11-17T11:30:00.000Z',
        },
      ],
    }).nome;

    expect(modifierViews(nome, TEST_NOW_MS)).toEqual([
      {
        key: '0-100',
        text: 'Montée de niveau des maisons bloquée',
        until: 'encore 1 h 30',
      },
    ]);
  });

  it('flags an effect that has not started yet', () => {
    const nome = withNome({
      modifiers: [
        {
          effect,
          startsAt: 115,
          endsAt: 120,
          endsAtIso: '2026-11-17T11:30:00.000Z',
        },
      ],
    }).nome;

    expect(modifierViews(nome, TEST_NOW_MS)[0].until).toBe(
      'à venir · encore 1 h 30',
    );
  });
});
