import { GAME_DATA } from '@nomarque/data';
import { drawFloods } from './floods';
import { REIGN_YEARS } from './reign';

describe('drawFloods', () => {
  it('draws one flood per year, the same for the same seed', () => {
    const floods = drawFloods('reign-1', GAME_DATA);
    expect(floods).toHaveLength(REIGN_YEARS);
    expect(drawFloods('reign-1', GAME_DATA)).toEqual(floods);
  });

  it('follows the flood chances over many reigns', () => {
    const counts = { low: 0, good: 0, high: 0 };
    const reigns = 2000;
    for (let i = 0; i < reigns; i++) {
      for (const flood of drawFloods(`reign-${i}`, GAME_DATA)) {
        counts[flood]++;
      }
    }
    const total = reigns * REIGN_YEARS;
    const p = GAME_DATA.parameters;
    expect(counts.low / total).toBeCloseTo(p.floodLowChance, 1);
    expect(counts.high / total).toBeCloseTo(p.floodHighChance, 1);
  });
});
