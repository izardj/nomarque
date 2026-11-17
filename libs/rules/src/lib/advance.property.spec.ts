import fc from 'fast-check';
import {
  BUILDING_IDS,
  FLOOD_LEVELS,
  GAME_DATA,
  RESOURCE_IDS,
  type ResourceId,
} from '@nomarque/data';
import { advance } from './advance';
import { mergeReports } from './report';
import {
  emptyRulesState,
  type NomeState,
  type ParcelState,
  type RulesContext,
} from './state';
import { reignLengthHours } from './reign';
import { expectClose } from '../testing/expect-close';

const REIGN_HOURS = reignLengthHours(GAME_DATA.parameters);
const buildingWorkers = new Map(
  GAME_DATA.buildings.map((b) => [b.id, b.workers]),
);

const parcelArb = (slot: number): fc.Arbitrary<ParcelState> =>
  fc.oneof(
    fc.constant<ParcelState>({
      slot,
      building: null,
      houses: null,
      workers: 0,
      buildEndsAt: null,
    }),
    fc.constantFrom(...BUILDING_IDS).chain((building) =>
      fc.record({
        slot: fc.constant(slot),
        building: fc.constant(building),
        houses: fc.constant(null),
        workers: fc.integer({
          min: 0,
          max: buildingWorkers.get(building) ?? 0,
        }),
        buildEndsAt: fc.option(fc.double({ min: 0.5, max: 200, noNaN: true }), {
          freq: 4,
        }),
      }),
    ),
    fc.record({
      slot: fc.constant(slot),
      building: fc.constant(null),
      houses: fc.record({
        level: fc.constantFrom(1 as const, 2 as const, 3 as const),
        count: fc.integer({ min: 1, max: 4 }),
      }),
      workers: fc.constant(0),
      buildEndsAt: fc.option(fc.double({ min: 0.5, max: 200, noNaN: true }), {
        freq: 4,
      }),
    }),
  );

const nomeArb: fc.Arbitrary<NomeState> = fc.record({
  deben: fc.double({ min: 0, max: 2000, noNaN: true }),
  stocks: fc.record(
    Object.fromEntries(
      RESOURCE_IDS.map((r) => [
        r,
        fc.double({ min: 0, max: 250, noNaN: true }),
      ]),
    ) as Record<ResourceId, fc.Arbitrary<number>>,
  ),
  parcels: fc.tuple(...GAME_DATA.map.map((s) => parcelArb(s.slot))),
  rules: fc.constant(emptyRulesState()),
});

const contextArb: fc.Arbitrary<RulesContext> = fc
  .array(fc.constantFrom(...FLOOD_LEVELS), { minLength: 4, maxLength: 4 })
  .map((floods) => ({ data: GAME_DATA, floods }));

/** Three ordered instants of the reign: a ≤ b ≤ c. */
const instantsArb = fc
  .array(fc.double({ min: 0, max: REIGN_HOURS, noNaN: true }), {
    minLength: 4,
    maxLength: 4,
  })
  .map(
    (xs) => [...xs].sort((x, y) => x - y) as [number, number, number, number],
  );

describe('advance: property', () => {
  it('advance(a→c) equals advance(b→c) after advance(a→b)', () => {
    fc.assert(
      fc.property(
        nomeArb,
        contextArb,
        instantsArb,
        (nome, context, [start, a, b, c]) => {
          // Run from the start first so that accumulators and house levels
          // are in a state the game can actually reach.
          const warm = advance(nome, start, a, context).state;
          const direct = advance(warm, a, c, context);
          const first = advance(warm, a, b, context);
          const second = advance(first.state, b, c, context);
          expectClose(second.state, direct.state);
          expectClose(mergeReports(first.report, second.report), direct.report);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('many short advances equal one long advance', () => {
    fc.assert(
      fc.property(
        nomeArb,
        contextArb,
        fc.double({ min: 0, max: REIGN_HOURS / 2, noNaN: true }),
        fc.array(fc.double({ min: 0.01, max: 13, noNaN: true }), {
          minLength: 1,
          maxLength: 30,
        }),
        (nome, context, start, steps) => {
          const end = Math.min(
            REIGN_HOURS,
            steps.reduce((t, s) => t + s, start),
          );
          const direct = advance(nome, start, end, context);
          let state = nome;
          let report = null;
          let t = start;
          for (const step of steps) {
            const next = Math.min(end, t + step);
            const r = advance(state, t, next, context);
            state = r.state;
            report = report ? mergeReports(report, r.report) : r.report;
            t = next;
          }
          expectClose(state, direct.state);
          expectClose(report, direct.report);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('is deterministic and leaves its input untouched', () => {
    fc.assert(
      fc.property(
        nomeArb,
        contextArb,
        instantsArb,
        (nome, context, [, a, , c]) => {
          const snapshot = JSON.stringify(nome);
          const first = advance(nome, a, c, context);
          const again = advance(nome, a, c, context);
          expect(JSON.stringify(nome)).toBe(snapshot);
          expect(again).toEqual(first);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('never yields negative or non-finite stocks', () => {
    fc.assert(
      fc.property(
        nomeArb,
        contextArb,
        instantsArb,
        (nome, context, [, a, , c]) => {
          const { state } = advance(nome, a, c, context);
          for (const quantity of Object.values(state.stocks)) {
            expect(Number.isFinite(quantity)).toBe(true);
            expect(quantity).toBeGreaterThanOrEqual(0);
          }
          expect(Number.isFinite(state.deben)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
