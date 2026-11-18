import { GAME_DATA } from '@nomarque/data';
import { NOME_STATE } from '../../core/testing';
import { cropOptions, isFinishedField } from './city-view';

const parcels = NOME_STATE.nome.parcels;
const WHEAT_FIELD = parcels[8];

describe('isFinishedField', () => {
  it('is true for a built field only', () => {
    expect(isFinishedField(WHEAT_FIELD)).toBe(true);
    expect(isFinishedField(parcels[0])).toBe(false);
    expect(isFinishedField(parcels[9])).toBe(false);
  });

  it('is false for a field still under construction', () => {
    const site = { ...WHEAT_FIELD, buildEndsAt: 120, buildEndsAtIso: 'x' };
    expect(isFinishedField(site)).toBe(false);
  });
});

describe('cropOptions', () => {
  it('offers the fields the zone allows, the current one flagged', () => {
    const options = cropOptions(WHEAT_FIELD);
    const allowed = GAME_DATA.buildings
      .filter((def) => def.kind === 'field' && def.zones.includes('black_land'))
      .map((def) => def.id);

    expect(options.map((option) => option.building)).toEqual(allowed);
    expect(options.filter((option) => option.current)).toEqual([
      expect.objectContaining({ building: 'farm_wheat', name: 'Champ de blé' }),
    ]);
  });

  it('offers nothing for a parcel that is not a finished field', () => {
    expect(cropOptions(parcels[0])).toEqual([]);
    expect(cropOptions(parcels[9])).toEqual([]);
  });
});
