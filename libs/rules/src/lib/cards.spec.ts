import {
  GAME_DATA,
  type CardEffect,
  type CardTrigger,
  type EventCardDef,
  type GameData,
} from '@nomarque/data';
import { chooseCard, chooseCrop, foundNome, makeOffering } from './actions';
import { advance } from './advance';
import { drawWeight } from './cards';
import { catalogOf } from './catalog';
import { workforce } from './economy';
import type { NomeState, RulesContext } from './state';

const P = GAME_DATA.parameters;
const INTERVAL = P.cardDrawIntervalHours;

function card(
  id: string,
  a: CardEffect[],
  b: CardEffect[] = [],
  trigger: CardTrigger = { kind: 'random' },
): EventCardDef {
  return {
    id,
    triggerRaw: '',
    trigger,
    phase: 'any',
    god: null,
    choices: [
      { key: 'a', effectRaw: '', effects: a },
      { key: 'b', effectRaw: '', effects: b },
    ],
    defaultChoice: 'b',
  };
}

/** Game data where every draw deals one of `cards`. */
function withCards(...cards: EventCardDef[]): GameData {
  return {
    ...GAME_DATA,
    cards,
    parameters: { ...P, cardDrawChance: 1 },
  };
}

function context(data: GameData): RulesContext {
  return { data, floods: ['good', 'good', 'good', 'good'], seed: 'nome' };
}

function expectOk(
  result: { ok: true; state: NomeState } | { ok: false; error: string },
): NomeState {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.state;
}

describe('event cards', () => {
  const tax = card(
    'T1',
    [{ kind: 'deben', amount: -50 }],
    [{ kind: 'resource', resource: 'wheat', amount: -10 }],
  );

  it('deals a card at each draw instant and applies the default at expiry', () => {
    const ctx = context(withCards(tax));
    const dealt = advance(foundNome(ctx.data), 0, INTERVAL, ctx);
    expect(dealt.report.cardsDealt).toEqual([
      { drawId: 1, cardId: 'T1', at: INTERVAL },
    ]);
    expect(dealt.state.rules.cards.pending).toEqual([
      {
        drawId: 1,
        cardId: 'T1',
        drawnAt: INTERVAL,
        expiresAt: INTERVAL + P.cardGraceHours,
      },
    ]);

    const expiry = INTERVAL + P.cardGraceHours;
    const later = advance(dealt.state, INTERVAL, expiry, ctx);
    expect(later.report.cardsDefaulted).toEqual([
      { drawId: 1, cardId: 'T1', drawnAt: INTERVAL, at: expiry, choice: 'b' },
    ]);
    expect(later.state.rules.cards.pending).toEqual([]);
  });

  it('deals each card once per Nile year', () => {
    const ctx = context(withCards(tax));
    const { report } = advance(foundNome(ctx.data), 0, P.yearHours + 1, ctx);
    expect(report.cardsDealt.map((c) => c.at)).toEqual([INTERVAL, P.yearHours]);
  });

  it('keeps at most cardMaxPending cards waiting', () => {
    const cards = Array.from({ length: P.cardMaxPending + 2 }, (_, i) =>
      card(`T${i}`, []),
    );
    const ctx = context(withCards(...cards));
    const { state } = advance(
      foundNome(ctx.data),
      0,
      INTERVAL * (P.cardMaxPending + 1),
      ctx,
    );
    expect(state.rules.cards.pending).toHaveLength(P.cardMaxPending);
  });

  it('refuses a choice the nome cannot afford and applies an affordable one', () => {
    const ctx = context(withCards(tax));
    const dealt = advance(foundNome(ctx.data), 0, INTERVAL, ctx).state;
    const broke = { ...dealt, deben: 10 };
    expect(chooseCard(broke, ctx, 1, 'a', INTERVAL)).toEqual({
      ok: false,
      error: 'cannot_afford',
    });
    const paid = expectOk(chooseCard(dealt, ctx, 1, 'a', INTERVAL));
    expect(paid.deben).toBeCloseTo(dealt.deben - 50, 9);
    expect(paid.rules.cards.pending).toEqual([]);
    expect(chooseCard(paid, ctx, 1, 'a', INTERVAL)).toEqual({
      ok: false,
      error: 'unknown_card',
    });
  });

  it('applies a lasting effect for its duration only', () => {
    const strike = card('T1', [
      {
        kind: 'workforce',
        workerClass: 'peasant',
        change: { percent: -100 },
        hours: 12,
      },
    ]);
    const ctx = context(withCards(strike));
    const catalog = catalogOf(ctx.data);
    const dealt = advance(foundNome(ctx.data), 0, INTERVAL, ctx).state;
    const struck = expectOk(chooseCard(dealt, ctx, 1, 'a', INTERVAL));
    const before = workforce(dealt, catalog, INTERVAL).classes.peasant
      .available;
    expect(before).toBeGreaterThan(0);
    expect(
      workforce(struck, catalog, INTERVAL + 1).classes.peasant.available,
    ).toBe(0);
    expect(
      workforce(struck, catalog, INTERVAL + 12).classes.peasant.available,
    ).toBe(before);
    const after = advance(struck, INTERVAL, INTERVAL + 13, ctx).state;
    expect(after.rules.modifiers).toEqual([]);
  });

  it('starts a delayed production bonus after the idle time', () => {
    const fishing = card('T1', [
      {
        kind: 'idle',
        target: { kind: 'building', building: 'fishery' },
        percent: -100,
        hours: 6,
      },
      {
        kind: 'production',
        resource: 'fish',
        percent: 30,
        hours: 24,
        startsAfter: 6,
      },
    ]);
    const ctx = context(withCards(fishing));
    const dealt = advance(foundNome(ctx.data), 0, INTERVAL, ctx).state;
    const chosen = expectOk(chooseCard(dealt, ctx, 1, 'a', INTERVAL));
    expect(chosen.rules.modifiers.map((m) => [m.startsAt, m.endsAt])).toEqual([
      [INTERVAL, INTERVAL + 6],
      [INTERVAL + 6, INTERVAL + 30],
    ]);
  });

  it('weighs cards by their trigger', () => {
    const ctx = context(GAME_DATA);
    const nome = foundNome(GAME_DATA);
    const rich = card('S', [], [], {
      kind: 'stockAbove',
      resource: 'wheat',
      quantity: 100,
    });
    expect(drawWeight(rich, nome, 8, ctx)).toBe(P.cardConditionalWeight);
    expect(drawWeight(rich, { ...nome, stocks: { wheat: 50 } }, 8, ctx)).toBe(
      0,
    );
    expect(drawWeight(card('R', [], [], { kind: 'rare' }), nome, 8, ctx)).toBe(
      P.cardRareWeight,
    );
    expect(
      drawWeight(card('X', [], [], { kind: 'tutorial' }), nome, 8, ctx),
    ).toBe(0);
  });

  it('resolves chances from the seed, the same way every time', () => {
    const gamble = card('T1', [
      {
        kind: 'chance',
        probability: 0.5,
        effect: { kind: 'deben', amount: 100 },
      },
    ]);
    const outcomes = new Set<number>();
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const ctx = { ...context(withCards(gamble)), seed };
      const dealt = advance(foundNome(ctx.data), 0, INTERVAL, ctx).state;
      const first = expectOk(chooseCard(dealt, ctx, 1, 'a', INTERVAL));
      const again = expectOk(chooseCard(dealt, ctx, 1, 'a', INTERVAL));
      expect(again.deben).toBe(first.deben);
      outcomes.add(first.deben - dealt.deben);
    }
    expect([...outcomes].sort()).toEqual([0, 100]);
  });
});

describe('gods', () => {
  const ctx = context({ ...GAME_DATA, cards: [] });

  it('lose favour every hour without a temple', () => {
    const { state } = advance(foundNome(ctx.data), 0, 100, ctx);
    expect(state.rules.gods.hapy).toBeCloseTo(
      P.godFavorStart - 100 * P.godFavorDecayPerHour,
      9,
    );
  });

  it('accept one offering per interval', () => {
    const nome = foundNome(ctx.data);
    const offered = expectOk(makeOffering(nome, ctx.data, 'osiris', 10));
    expect(offered.rules.gods.osiris).toBe(
      P.godFavorStart + ctx.data.gods[1].favorPerOffering,
    );
    expect(makeOffering(offered, ctx.data, 'hapy', 11)).toEqual({
      ok: false,
      error: 'offering_too_soon',
    });
    expect(
      makeOffering(offered, ctx.data, 'hapy', 10 + P.offeringIntervalHours).ok,
    ).toBe(true);
  });

  it('let a blessed Osiris raise the harvest', () => {
    const plain = advance(foundNome(ctx.data), 0, 120, ctx).report;
    const blessed = foundNome(ctx.data);
    blessed.rules.gods.osiris = P.godFavorMax;
    const { report } = advance(blessed, 0, 120, ctx);
    expect(report.harvested.wheat).toBeCloseTo(
      (plain.harvested.wheat ?? 0) * (1 + P.osirisHarvestShare),
      9,
    );
  });

  it('reward the tribute with the pharaoh’s favour', () => {
    const before = advance(foundNome(ctx.data), 0, 165, ctx).state;
    const { state, report } = advance(before, 165, 167, ctx);
    const paid = report.tribute.wheat ?? 0;
    expect(report.royalFavor).toBeCloseTo(paid * P.royalFavorPerTribute, 9);
    expect(state.favor).toBeCloseTo(before.favor + report.royalFavor, 9);
  });
});

describe('crops', () => {
  it('can be swapped during Akhet only', () => {
    const nome = foundNome(GAME_DATA);
    const swapped = expectOk(
      chooseCrop(nome, GAME_DATA, 10, 'farm_barley', 10),
    );
    expect(swapped.parcels[10].building).toBe('farm_barley');
    expect(chooseCrop(nome, GAME_DATA, 10, 'farm_barley', 50)).toEqual({
      ok: false,
      error: 'crops_locked',
    });
    expect(chooseCrop(nome, GAME_DATA, 6, 'farm_barley', 10)).toEqual({
      ok: false,
      error: 'not_a_field',
    });
  });
});
