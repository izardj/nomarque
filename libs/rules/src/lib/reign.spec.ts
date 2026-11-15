import { GAME_DATA } from '@nomarque/data';
import { reignLengthHours } from './reign';
import { toRealMs } from './time';

describe('reignLengthHours', () => {
  it('lasts four Nile years', () => {
    expect(reignLengthHours({ yearHours: 168 })).toBe(672);
  });

  it('fits in four real days at speed 7 with the current data', () => {
    expect(toRealMs(reignLengthHours(GAME_DATA.parameters), 7)).toBe(
      4 * 24 * 3_600_000,
    );
  });
});
