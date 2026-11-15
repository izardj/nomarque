import type { BuildingDef, GameData, ResourceId } from '@nomarque/data';
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
});
