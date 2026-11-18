import type { CardEffect } from '@nomarque/data';
import { NOME_STATE, PENDING_CARD, withNome } from '../../core/testing';
import {
  buildCardView,
  cardArt,
  defaultFootnote,
  formatEffectText,
  isMalus,
  isPenalty,
} from './cards-view';
import { TEST_NOW_MS } from '../../core/testing';

const NOME_WITH_CARD = withNome({ cards: [PENDING_CARD] }).nome;

describe('formatEffectText', () => {
  it('shows the separators of the spreadsheet as middle dots', () => {
    expect(formatEffectText('poisson -5 ; Bastet +10')).toBe(
      'poisson -5 · Bastet +10',
    );
  });

  it('leaves a single effect alone', () => {
    expect(formatEffectText('récolte -20 %')).toBe('récolte -20 %');
  });
});

describe('isMalus', () => {
  const cases: [string, CardEffect, boolean][] = [
    [
      'a lost resource',
      { kind: 'resource', resource: 'fish', amount: -5 },
      true,
    ],
    [
      'a gained resource',
      { kind: 'resource', resource: 'wheat', amount: 30 },
      false,
    ],
    ['a favour lost', { kind: 'godFavor', god: 'thoth', amount: -5 }, true],
    ['a favour gained', { kind: 'godFavor', god: 'all', amount: 5 }, false],
    ['a smaller harvest', { kind: 'harvest', percent: -15 }, true],
    ['a bigger harvest', { kind: 'harvest', percent: 10 }, false],
    ['a heavier tribute', { kind: 'tribute', percent: 10 }, true],
    ['a lighter tribute', { kind: 'tribute', percent: -10 }, false],
    [
      'a higher consumption',
      { kind: 'consumption', resource: 'wheat', percent: 20, hours: 48 },
      true,
    ],
    [
      'a lower consumption',
      { kind: 'consumption', resource: 'wheat', percent: -20, hours: 48 },
      false,
    ],
    [
      'fewer workers for a while',
      {
        kind: 'workforce',
        workerClass: 'peasant',
        change: { count: -10 },
        hours: 48,
      },
      true,
    ],
    [
      'a blocked house upgrade',
      { kind: 'houseUpgrade', mode: 'blocked', hours: 24 },
      true,
    ],
    [
      'a faster house upgrade',
      { kind: 'houseUpgrade', mode: 'fast', hours: 24 },
      false,
    ],
    ['a flood forecast', { kind: 'floodForecast', hours: 6 }, false],
    [
      'a risky malus',
      {
        kind: 'chance',
        probability: 0.5,
        effect: { kind: 'harvest', percent: -15 },
      },
      true,
    ],
  ];

  it.each(cases)('tells %s', (_name, effect, expected) => {
    expect(isMalus(effect)).toBe(expected);
  });
});

describe('isPenalty', () => {
  it('needs at least one effect, all of them hurting', () => {
    const loss: CardEffect = { kind: 'deben', amount: -30 };
    const gain: CardEffect = { kind: 'deben', amount: 30 };

    expect(isPenalty([])).toBe(false);
    expect(isPenalty([loss])).toBe(true);
    expect(isPenalty([loss, gain])).toBe(false);
  });
});

describe('cardArt', () => {
  it('tints the illustration with the phase and names the god', () => {
    expect(cardArt('C01')).toMatchObject({ god: 'Bastet' });
    expect(cardArt('C05').god).toBe('Osiris');
    expect(cardArt('C05').sky).not.toBe(cardArt('C01').sky);
  });
});

describe('defaultFootnote', () => {
  it('tells which choice Méri makes and in how long', () => {
    expect(defaultFootnote(PENDING_CARD, TEST_NOW_MS)).toBe(
      "Sans réponse dans 22 h, Méri choisira « Attendre qu'il se réveille ».",
    );
  });

  it('says so when the time is up', () => {
    expect(
      defaultFootnote(PENDING_CARD, Date.parse(PENDING_CARD.expiresAtIso)),
    ).toBe(
      "Méri va choisir « Attendre qu'il se réveille » d'un instant à l'autre.",
    );
  });
});

describe('buildCardView', () => {
  it('has nothing to show without pending card', () => {
    expect(buildCardView(NOME_STATE.nome, TEST_NOW_MS)).toBeNull();
  });

  it('shows the first pending card with its position and texts', () => {
    const nome = withNome({
      cards: [PENDING_CARD, { ...PENDING_CARD, drawId: 8 }],
    }).nome;
    const view = buildCardView(nome, TEST_NOW_MS);

    expect(view?.position).toBe('Peret · carte 1 sur 2');
    expect(view?.drawId).toBe(7);
    expect(view?.title).toBe('Le chat sacré');
  });

  it('gives each choice its label, effect line and reason when unaffordable', () => {
    const view = buildCardView(NOME_WITH_CARD, TEST_NOW_MS);

    expect(
      view?.choices.map((c) => [c.key, c.label, c.effect, c.reason]),
    ).toEqual([
      ['a', "Attendre qu'il se réveille", 'grenier inaccessible 6 h', null],
      [
        'b',
        "L'honorer d'un poisson",
        'poisson -5 · Bastet +10',
        'Pas de quoi payer',
      ],
    ]);
    expect(view?.choices.map((c) => c.affordable)).toEqual([true, false]);
  });

  it('marks as penalty the choice that only costs', () => {
    const view = buildCardView(NOME_WITH_CARD, TEST_NOW_MS);
    expect(view?.choices.map((c) => c.penalty)).toEqual([true, false]);
  });
});
