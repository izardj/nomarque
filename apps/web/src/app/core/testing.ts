import type {
  MeResponse,
  NomeStateResponse,
  ParcelDto,
  StewardReportDto,
} from '@nomarque/contracts';

export const ME_WITHOUT_DYNASTY: MeResponse = {
  player: { id: 'p1', email: 'pharaoh@example.com', displayName: null },
  dynasty: null,
};

export const ME_WITH_DYNASTY: MeResponse = {
  player: { id: 'p1', email: 'pharaoh@example.com', displayName: null },
  dynasty: { id: 'd1', name: 'Existing House', prestige: 3 },
};

/** The instant the countdowns of the test state are read at. */
export const TEST_NOW_MS = Date.parse('2026-11-17T10:00:00.000Z');

const NO_CONSTRUCTION = { buildEndsAt: null, buildEndsAtIso: null } as const;

function parcel(
  slot: number,
  zone: ParcelDto['zone'],
  content: Partial<ParcelDto> = {},
): ParcelDto {
  return {
    slot,
    row: Math.floor(slot / 4),
    col: slot % 4,
    zone,
    building: null,
    houses: null,
    workers: 0,
    occupancy: null,
    perYear: {},
    harvest: null,
    ...NO_CONSTRUCTION,
    ...content,
  };
}

export const EMPTY_REPORT: StewardReportDto = {
  from: 100,
  to: 100,
  produced: {},
  consumed: {},
  lost: {},
  harvested: {},
  tribute: {},
  tributeMissing: {},
  shortages: {},
  taxes: 0,
  completed: [],
  houseChanges: [],
  houseWarnings: [],
};

export const BUSY_REPORT: StewardReportDto = {
  ...EMPTY_REPORT,
  from: 100,
  to: 109.2,
  produced: { bread: 72, beer: 40 },
  consumed: { wheat: 54 },
  lost: { wheat: 12 },
  harvested: { wheat: 200 },
  tribute: { wheat: 40 },
  tributeMissing: { barley: 5 },
  shortages: { fish: 8 },
  taxes: 18,
  completed: [5],
  houseChanges: [{ slot: 4, at: 105, from: 2, to: 1 }],
  houseWarnings: [{ slot: 4, at: 108 }],
};

/** A nome in the middle of Peret, with one parcel of each kind. */
export const NOME_STATE: NomeStateResponse = {
  nome: {
    id: 'n1',
    name: 'Nome du Faucon',
    region: 'middle_egypt',
    dynastyName: 'Maison des Séthides',
    deben: 1240.4,
    favor: 86,
    gameHours: 109.2,
    nile: {
      year: 0,
      phase: 'peret',
      hourOfYear: 109.2,
      flood: 'good',
      nextPhase: 'shemu',
      nextPhaseAt: 200,
      nextPhaseAtIso: '2026-11-18T10:00:00.000Z',
    },
    stocks: { wheat: 150 },
    capacity: 300,
    workforce: {
      peasant: { available: 58, assigned: 57, ratio: 1 },
      artisan: { available: 29, assigned: 22, ratio: 1 },
      scribe: { available: 19, assigned: 2, ratio: 1 },
      priest: { available: 0, assigned: 0, ratio: 1 },
    },
    parcels: [
      parcel(0, 'desert', {
        building: 'limestone_quarry',
        workers: 4,
        occupancy: 4 / 6,
        perYear: { limestone: 90 },
      }),
      parcel(1, 'desert', {
        building: 'brickworks',
        workers: 3,
        occupancy: 1,
        perYear: { bricks: 110 },
      }),
      parcel(2, 'desert'),
      parcel(3, 'desert'),
      parcel(4, 'city', { houses: { level: 1, count: 3 } }),
      parcel(5, 'city', {
        building: 'bakery',
        workers: 3,
        occupancy: 1,
        perYear: { bread: 110 },
      }),
      parcel(6, 'city', { building: 'temple', workers: 2, occupancy: 1 }),
      parcel(7, 'city', {
        houses: { level: 2, count: 2 },
        buildEndsAt: 111,
        buildEndsAtIso: '2026-11-17T12:10:00.000Z',
      }),
      parcel(8, 'black_land', {
        building: 'farm_wheat',
        workers: 8,
        occupancy: 1,
        harvest: { wheat: 200 },
      }),
      parcel(9, 'black_land'),
      parcel(10, 'black_land'),
      parcel(11, 'black_land'),
      parcel(12, 'river', {
        building: 'fishery',
        workers: 3,
        occupancy: 1,
        perYear: { fish: 150 },
      }),
      parcel(13, 'river'),
      parcel(14, 'river'),
      parcel(15, 'river'),
    ],
    dataVersion: 'test',
  },
  report: BUSY_REPORT,
};

export function nomeState(
  overrides: Partial<NomeStateResponse> = {},
): NomeStateResponse {
  return { ...NOME_STATE, ...overrides };
}
