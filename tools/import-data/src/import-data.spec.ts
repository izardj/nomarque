import type { CardChoiceKey, CardEffect } from '@nomarque/data';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GAME_DATA_PATH,
  buildGameData,
  renderGameDataFile,
  renderLabelsFile,
} from './build';
import { findWorkspaceRoot, readRealSources } from './test-helpers';

const built = buildGameData(readRealSources());
const { data, labels } = built;

function effectsOf(id: string, key: CardChoiceKey): CardEffect[] | undefined {
  const card = data.cards.find((candidate) => candidate.id === id);
  return card?.choices.find((choice) => choice.key === key)?.effects;
}

describe('real data import', () => {
  it('imports the expected number of rows of every kind', () => {
    expect(data.resources).toHaveLength(17);
    expect(data.buildings).toHaveLength(19);
    expect(data.houses).toHaveLength(4);
    expect(data.expeditions).toHaveLength(8);
    expect(data.cards).toHaveLength(30);
    expect(data.gods).toHaveLength(5);
  });

  it.each<[string, CardChoiceKey, CardEffect[]]>([
    [
      'C02',
      'b',
      [
        { kind: 'resource', resource: 'wheat', amount: -30 },
        { kind: 'godFavor', god: 'thoth', amount: -5 },
      ],
    ],
    [
      'C02',
      'c',
      [
        {
          kind: 'workforce',
          workerClass: 'scribe',
          change: { percent: -100 },
          hours: 12,
        },
        { kind: 'resource', resource: 'wheat', amount: 15 },
      ],
    ],
    [
      'C05',
      'a',
      [
        {
          kind: 'idle',
          target: { kind: 'fields' },
          percent: -50,
          hours: 12,
        },
      ],
    ],
    [
      'C05',
      'b',
      [
        { kind: 'godFavor', god: 'osiris', amount: -10 },
        {
          kind: 'chance',
          probability: 0.5,
          effect: { kind: 'harvest', percent: -15 },
        },
      ],
    ],
    [
      'C11',
      'a',
      [
        {
          kind: 'workforce',
          workerClass: 'peasant',
          change: { count: -10 },
          hours: 48,
        },
        { kind: 'royalFavor', amount: 20 },
      ],
    ],
    [
      'C13',
      'c',
      [
        { kind: 'deben', amount: -40 },
        { kind: 'tribute', percent: -20 },
        {
          kind: 'chance',
          probability: 0.25,
          effect: { kind: 'royalFavor', amount: -15 },
        },
      ],
    ],
    [
      'C24',
      'a',
      [
        {
          kind: 'workforce',
          workerClass: 'all',
          change: { percent: -100 },
          hours: 6,
        },
      ],
    ],
    [
      'C29',
      'a',
      [
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
      ],
    ],
    [
      'C15',
      'a',
      [
        { kind: 'deben', amount: -60 },
        {
          kind: 'production',
          resource: 'pottery',
          percent: 20,
          hours: 'year',
          startsAfter: 0,
        },
      ],
    ],
    ['C17', 'b', [{ kind: 'godFavor', god: 'all', amount: -2 }]],
  ])('imports the effects of %s/%s exactly', (id, key, expected) => {
    expect(effectsOf(id, key)).toEqual(expected);
  });

  it.each<[string, unknown]>([
    ['C01', { kind: 'tutorial' }],
    ['C16', { kind: 'housesAtLeast', count: 3 }],
    ['C24', { kind: 'busyWorkers', workerClass: 'peasant', hours: 48 }],
    ['C28', { kind: 'priceAbove', resource: 'bread', factor: 1.4 }],
  ])('imports the trigger of %s exactly', (id, expected) => {
    expect(data.cards.find((card) => card.id === id)?.trigger).toEqual(
      expected,
    );
  });

  it('imports the gods table', () => {
    expect(data.gods).toEqual([
      {
        id: 'hapy',
        offering: { resource: 'wheat', quantity: 20 },
        favorPerOffering: 10,
      },
      {
        id: 'osiris',
        offering: { resource: 'wheat', quantity: 20 },
        favorPerOffering: 10,
      },
      {
        id: 'thoth',
        offering: { resource: 'bread', quantity: 10 },
        favorPerOffering: 10,
      },
      {
        id: 'bastet',
        offering: { resource: 'fish', quantity: 10 },
        favorPerOffering: 10,
      },
      {
        id: 'sekhmet',
        offering: { resource: 'bread', quantity: 10 },
        favorPerOffering: 10,
      },
    ]);
  });

  it('imports the J2 favour and card parameters', () => {
    expect(data.parameters).toMatchObject({
      godFavorStart: 50,
      godFavorMax: 100,
      godFavorDecayPerHour: 0.1,
      templeFavorPerHour: 0.1,
      godFavorLow: 30,
      godFavorVeryLow: 15,
      godFavorBlessing: 70,
      offeringIntervalHours: 24,
      hapyLowFloodMultiplier: 0.8,
      osirisHarvestShare: 0.1,
      bastetUpgradeHours: 18,
      cardDrawIntervalHours: 8,
      cardDrawChance: 0.8,
      cardMaxPending: 3,
      cardGraceHours: 24,
      cardConditionalWeight: 3,
      cardRareWeight: 0.2,
      royalFavorHigh: 50,
      royalFavorPerTribute: 0.2,
      royalFavorPerMissingTribute: 0.5,
      prestigeFirst: 10,
      prestigeSecond: 6,
      prestigeThird: 3,
      prestigeParticipation: 1,
      floodLowChance: 0.25,
      floodHighChance: 0.2,
    });
  });

  it('imports the bakery exactly', () => {
    expect(data.buildings.find((building) => building.id === 'bakery')).toEqual(
      {
        id: 'bakery',
        kind: 'workshop',
        zones: ['city'],
        workerClass: 'artisan',
        workers: 3,
        inputs: [{ resource: 'wheat', perYear: 120 }],
        outputs: [{ resource: 'bread', perYear: 110 }],
        cost: { deben: 60 },
        buildHours: 8,
        service: null,
        range: null,
      },
    );
  });

  it('imports hut needs and services', () => {
    const hut = data.houses.find((house) => house.id === 'hut');

    expect(hut?.needs).toEqual([
      { resource: 'wheat', perInhabitantPerYear: 4 },
    ]);
    expect(hut?.services).toEqual(['water']);
  });

  it('marks the villa as out of the MVP and counts its two temples', () => {
    const villa = data.houses.find((house) => house.id === 'villa');

    expect(villa?.inMvp).toBe(false);
    expect(villa?.services).toEqual([
      'water',
      'temple',
      'temple',
      'entertainment',
    ]);
  });

  it('imports the flood multipliers', () => {
    expect(data.parameters.floodMultiplier).toEqual({
      low: 0.6,
      good: 1,
      high: 1.25,
    });
  });

  it('imports the starting map, stocks, house zones and cereals', () => {
    expect(data.map.map((slot) => slot.slot)).toEqual([...Array(20).keys()]);
    expect(data.map[5].start).toEqual({ kind: 'houses', house: 'hut' });
    expect(data.map[10].start).toEqual({
      kind: 'building',
      building: 'farm_wheat',
    });
    expect(data.startingStocks).toEqual({ wheat: 150, scrolls: 20 });
    expect(data.parameters.houseZones).toEqual([
      'city',
      'black_land',
      'desert',
    ]);
    expect(
      data.resources
        .filter((resource) => resource.cereal)
        .map((resource) => resource.id),
    ).toEqual(['wheat', 'barley']);
  });

  it('derives a deterministic 12 character hexadecimal version', () => {
    expect(data.version).toMatch(/^[0-9a-f]{12}$/);
    expect(buildGameData(readRealSources()).data.version).toBe(data.version);
  });

  it('renders byte-identical files on every run', async () => {
    const root = findWorkspaceRoot();
    const gameDataPath = join(root, GAME_DATA_PATH);
    const labelsPath = join(root, 'libs/data/src/generated/fr.generated.ts');

    const firstData = await renderGameDataFile(data, gameDataPath);
    const secondData = await renderGameDataFile(
      buildGameData(readRealSources()).data,
      gameDataPath,
    );
    const firstLabels = await renderLabelsFile(labels, labelsPath);
    const secondLabels = await renderLabelsFile(
      buildGameData(readRealSources()).labels,
      labelsPath,
    );

    expect(secondData).toBe(firstData);
    expect(secondLabels).toBe(firstLabels);
    expect(firstData).toContain(
      '// Generated by nx run tools:import-data from data/economie. Do not edit.',
    );
    expect(firstLabels).toContain('export const FR_LABELS =');
  });
});
