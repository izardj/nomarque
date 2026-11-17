import { GAME_DATA } from '@nomarque/data';
import { advance } from './advance';
import { assignWorkers, build, foundNome } from './actions';
import { catalogOf } from './catalog';
import { workforce } from './economy';
import type { NomeState, ParcelState, RulesContext } from './state';

const P = GAME_DATA.parameters;
const good: RulesContext = {
  data: GAME_DATA,
  floods: ['good', 'good', 'good', 'good'],
};
const low: RulesContext = {
  data: GAME_DATA,
  floods: ['low', 'good', 'good', 'good'],
};

const hut = GAME_DATA.houses[0];
const hutNeed = hut.needs[0];
const startHuts = P.housesPerBlock;
const people = hut.inhabitants * startHuts;
const field = catalogOf(GAME_DATA).building('farm_wheat');

function withParcel(state: NomeState, parcel: ParcelState): NomeState {
  return {
    ...state,
    parcels: state.parcels.map((p) => (p.slot === parcel.slot ? parcel : p)),
  };
}

function hutsEatPerHour(): number {
  return (hutNeed.perInhabitantPerYear * people) / P.yearHours;
}

describe('foundNome', () => {
  it('lays out the starting city from the game data', () => {
    const nome = foundNome(GAME_DATA);
    expect(nome.parcels).toHaveLength(GAME_DATA.map.length);
    expect(nome.deben).toBe(P.startingDeben);
    expect(nome.stocks).toEqual(GAME_DATA.startingStocks);
    const huts = nome.parcels.filter((p) => p.houses);
    expect(huts).toEqual([
      expect.objectContaining({
        houses: { level: 1, count: startHuts },
        buildEndsAt: null,
      }),
    ]);
  });
});

describe('advance', () => {
  it('feeds the huts and collects taxes continuously', () => {
    const { state, report } = advance(foundNome(GAME_DATA), 0, 42, good);
    const eaten = hutsEatPerHour() * 42;
    expect(state.stocks.wheat).toBeCloseTo(
      (GAME_DATA.startingStocks.wheat ?? 0) - eaten,
      9,
    );
    expect(report.consumed.wheat).toBeCloseTo(eaten, 9);
    const taxes = (hut.taxPerInhabitantPerYear * people * 42) / P.yearHours;
    expect(state.deben).toBeCloseTo(P.startingDeben + taxes, 9);
    expect(report.taxes).toBeCloseTo(taxes, 9);
  });

  it('harvests a fully staffed field at hour 120 with the flood multiplier', () => {
    const goodYear = advance(foundNome(GAME_DATA), 0, 120, good);
    const lowYear = advance(foundNome(GAME_DATA), 0, 120, low);
    const output = field.outputs[0].perYear;
    expect(goodYear.report.harvested.wheat).toBeCloseTo(
      output * P.floodMultiplier.good,
      9,
    );
    expect(lowYear.report.harvested.wheat).toBeCloseTo(
      output * P.floodMultiplier.low,
      9,
    );
  });

  it('harvests in proportion to the mean Peret occupancy', () => {
    const half = assignWorkers(
      foundNome(GAME_DATA),
      GAME_DATA,
      8,
      field.workers / 2,
    );
    if (!half.ok) {
      throw new Error(half.error);
    }
    const { report } = advance(half.state, 0, 120, good);
    expect(report.harvested.wheat).toBeCloseTo(field.outputs[0].perYear / 2, 9);
  });

  it('levies the tribute on harvested cereals at hour 166', () => {
    const before = advance(foundNome(GAME_DATA), 0, 165, good).state;
    const { report } = advance(before, 165, 167, good);
    expect(report.tribute.wheat).toBeCloseTo(
      field.outputs[0].perYear * P.tributeRate,
      9,
    );
  });

  it('frees field workers during Akhet', () => {
    const catalog = catalogOf(GAME_DATA);
    const nome = foundNome(GAME_DATA);
    expect(workforce(nome, catalog, 'akhet').classes.peasant.assigned).toBe(2);
    expect(workforce(nome, catalog, 'peret').classes.peasant.assigned).toBe(
      2 + field.workers,
    );
    expect(workforce(nome, catalog, 'peret').classes.peasant.available).toBe(
      Math.floor(people * P.activityRate),
    );
  });

  it('prorates every assignment of a class when it exceeds the supply', () => {
    const catalog = catalogOf(GAME_DATA);
    let nome = foundNome(GAME_DATA);
    for (const slot of [9, 10, 11]) {
      nome = withParcel(nome, {
        slot,
        building: 'farm_barley',
        houses: null,
        workers: field.workers,
        buildEndsAt: null,
      });
    }
    const work = workforce(nome, catalog, 'peret');
    const { available, assigned, ratio } = work.classes.peasant;
    expect(assigned).toBe(2 + 4 * field.workers);
    expect(ratio).toBeCloseTo(available / assigned, 12);
    expect(work.occupancy.get(8)).toBeCloseTo(ratio, 12);
    expect(work.occupancy.get(5)).toBeCloseTo(ratio, 12);
  });

  it('caps stocks at the storage capacity and reports the loss', () => {
    const nome = { ...foundNome(GAME_DATA), stocks: { wheat: 590 } };
    const { state, report } = advance(nome, 100, 120, good);
    const capacity = P.baseStorage + P.granaryCapacity;
    expect(state.stocks.wheat).toBeCloseTo(capacity, 9);
    expect(report.lost.wheat).toBeGreaterThan(0);
  });

  it('runs a workshop only as far as its input allows', () => {
    const nome = withParcel(
      { ...foundNome(GAME_DATA), stocks: { wheat: 1 } },
      {
        slot: 7,
        building: 'bakery',
        houses: null,
        workers: 3,
        buildEndsAt: null,
      },
    );
    // No artisans live in huts: the bakery stays idle.
    const idle = advance(nome, 0, 24, good);
    expect(idle.report.produced.bread).toBeUndefined();
  });

  it('delivers a construction at its end and reports it', () => {
    const started = build(
      foundNome(GAME_DATA),
      GAME_DATA,
      9,
      { kind: 'building', building: 'farm_barley' },
      10,
    );
    if (!started.ok) {
      throw new Error(started.error);
    }
    const parcel = started.state.parcels[9];
    expect(parcel.buildEndsAt).toBe(
      10 + catalogOf(GAME_DATA).building('farm_barley').buildHours,
    );
    const { state, report } = advance(started.state, 10, 20, good);
    expect(report.completed).toEqual([9]);
    expect(state.parcels[9].buildEndsAt).toBeNull();
  });

  it('warns about a hut without water but never drops below level 1', () => {
    const nome = withParcel(foundNome(GAME_DATA), {
      slot: 5,
      building: 'well',
      houses: null,
      workers: 0,
      buildEndsAt: null,
    });
    const { state, report } = advance(nome, 0, 60, good);
    expect(report.houseWarnings.map((w) => w.slot)).toEqual([4]);
    expect(state.parcels[4].houses?.level).toBe(1);
  });

  it('raises a block of houses after 24 hours of met needs, lowers it after 48 missing', () => {
    let nome = foundNome(GAME_DATA);
    // Slot 0 sits right above the huts (slot 4), within the temple's range.
    nome = withParcel(nome, {
      slot: 0,
      building: 'temple',
      houses: null,
      workers: 2,
      buildEndsAt: null,
    });
    nome = {
      ...nome,
      stocks: { wheat: 150, bread: 50, fish: 50, pottery: 10 },
    };
    // Grid point 6 opens the first cell; 24 hours later the huts move up.
    const up = advance(nome, 1, 31, good);
    expect(up.report.houseChanges).toEqual([
      { slot: 4, at: 30, from: 1, to: 2 },
    ]);

    const starved = { ...up.state, stocks: { wheat: 150 } };
    const down = advance(starved, 31, 31 + 60, good);
    expect(down.report.houseChanges).toEqual([
      { slot: 4, at: 78, from: 2, to: 1 },
    ]);
  });
});
