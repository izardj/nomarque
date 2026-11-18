import type {
  BuildingDef,
  BuildingId,
  GameData,
  MapSlotDef,
  ResourceId,
} from '@nomarque/data';
import { describe, expect, it } from 'vitest';
import { buildGameData } from './build';
import { gameDataSchema } from './schemas';
import { readRealSources } from './test-helpers';

function validGameData(): GameData {
  return structuredClone(buildGameData(readRealSources()).data);
}

function findBuilding(data: GameData, id: BuildingDef['id']): BuildingDef {
  const building = data.buildings.find((candidate) => candidate.id === id);
  if (building === undefined) {
    throw new Error(`missing building "${id}" in the fixture`);
  }
  return building;
}

function findSlot(data: GameData, slot: number): MapSlotDef {
  const found = data.map.find((candidate) => candidate.slot === slot);
  if (found === undefined) {
    throw new Error(`missing map slot ${slot} in the fixture`);
  }
  return found;
}

describe('gameDataSchema', () => {
  it('accepts the data built from the real CSV files', () => {
    expect(gameDataSchema.safeParse(validGameData()).success).toBe(true);
  });

  it('rejects negative numeric values', () => {
    const data = validGameData();
    data.resources[0].referencePrice = -1;

    const result = gameDataSchema.safeParse(data);

    expect(result.success).toBe(false);
  });

  it('rejects a resource id that is not defined in resources', () => {
    const data = validGameData();
    findBuilding(data, 'farm_wheat').outputs[0].resource =
      'unobtainium' as ResourceId;

    const result = gameDataSchema.safeParse(data);

    expect(result.success).toBe(false);
  });

  it('rejects a workshop input that nothing produces', () => {
    const data = validGameData();
    data.expeditions = [];
    findBuilding(data, 'bakery').inputs[0].resource = 'copper';

    const result = gameDataSchema.safeParse(data);

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    const messages = result.error.issues.map((issue) => issue.message);
    expect(messages).toContain(
      'building "bakery" consumes "copper", which no building produces and no expedition brings back',
    );
  });

  it('rejects a default choice that is not one of the card choices', () => {
    const data = validGameData();
    data.cards[0].defaultChoice = 'c';

    const result = gameDataSchema.safeParse(data);

    expect(result.success).toBe(false);
  });

  it('rejects duplicate identifiers', () => {
    const data = validGameData();
    data.buildings.push(structuredClone(findBuilding(data, 'bakery')));

    const result = gameDataSchema.safeParse(data);

    expect(result.success).toBe(false);
  });

  it('rejects an effect with an unknown resource id', () => {
    const data = validGameData();
    const effect = data.cards
      .find((card) => card.id === 'C02')
      ?.choices.find((choice) => choice.key === 'b')?.effects[0];
    if (effect?.kind !== 'resource') {
      throw new Error('the C02/b fixture no longer starts with a resource');
    }
    effect.resource = 'unobtainium' as ResourceId;

    expect(gameDataSchema.safeParse(data).success).toBe(false);
  });

  it('rejects a chance probability above 1', () => {
    const data = validGameData();
    const chance = data.cards
      .find((card) => card.id === 'C05')
      ?.choices.find((choice) => choice.key === 'b')?.effects[1];
    if (chance?.kind !== 'chance') {
      throw new Error('the C05/b fixture no longer ends with a chance');
    }
    chance.probability = 2;

    expect(gameDataSchema.safeParse(data).success).toBe(false);
  });

  it('rejects a trigger that references an unknown building', () => {
    const data = validGameData();
    const trigger = data.cards.find((card) => card.id === 'C14')?.trigger;
    if (trigger?.kind !== 'built') {
      throw new Error('the C14 fixture no longer triggers on a building');
    }
    trigger.building = 'castle' as BuildingId;

    expect(gameDataSchema.safeParse(data).success).toBe(false);
  });

  it('rejects a missing god', () => {
    const data = validGameData();
    data.gods.splice(2, 1);

    expect(gameDataSchema.safeParse(data).success).toBe(false);
  });

  it('rejects a duplicate god', () => {
    const data = validGameData();
    data.gods.push(structuredClone(data.gods[0]));

    expect(gameDataSchema.safeParse(data).success).toBe(false);
  });

  it.each<[string, (data: GameData) => void]>([
    ['a missing map slot', (data) => data.map.splice(3, 1)],
    ['a duplicate map slot', (data) => (findSlot(data, 1).slot = 0)],
    [
      'a duplicate map position',
      (data) => {
        findSlot(data, 1).row = findSlot(data, 0).row;
        findSlot(data, 1).col = findSlot(data, 0).col;
      },
    ],
    [
      'a starting building on a zone it cannot use',
      (data) => (findSlot(data, 10).zone = 'city'),
    ],
    [
      'a starting house on a zone that is not allowed',
      (data) => (findSlot(data, 5).zone = 'river'),
    ],
    [
      'a starting house that is not in the MVP',
      (data) => (findSlot(data, 5).start = { kind: 'houses', house: 'villa' }),
    ],
    ['a negative starting stock', (data) => (data.startingStocks.wheat = -1)],
    [
      'a starting stock of an unknown resource',
      (data) => (data.startingStocks['unobtainium' as ResourceId] = 1),
    ],
    [
      'a new parameter that is not positive',
      (data) => (data.parameters.baseStorage = 0),
    ],
    [
      'a negative startingDeben',
      (data) => (data.parameters.startingDeben = -1),
    ],
    [
      'a godFavorVeryLow that is not below godFavorLow',
      (data) => (data.parameters.godFavorVeryLow = data.parameters.godFavorLow),
    ],
    [
      'a godFavorBlessing above godFavorMax',
      (data) => (data.parameters.godFavorBlessing = 101),
    ],
    [
      'a godFavorStart above godFavorMax',
      (data) => (data.parameters.godFavorStart = 101),
    ],
    [
      'a card draw chance of zero',
      (data) => (data.parameters.cardDrawChance = 0),
    ],
    [
      'a fractional maximum of pending cards',
      (data) => (data.parameters.cardMaxPending = 1.5),
    ],
  ])('rejects %s', (_name, mutate) => {
    const data = validGameData();
    mutate(data);

    expect(gameDataSchema.safeParse(data).success).toBe(false);
  });

  it('allows a zero startingDeben', () => {
    const data = validGameData();
    data.parameters.startingDeben = 0;

    expect(gameDataSchema.safeParse(data).success).toBe(true);
  });
});
