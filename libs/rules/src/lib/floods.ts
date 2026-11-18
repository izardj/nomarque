// The Nile floods of a reign, drawn when the reign is created and revealed
// one by one at the start of each Akhet.

import type { FloodLevel, GameData } from '@nomarque/data';
import { randomUnit } from './random';
import { REIGN_YEARS } from './reign';

/** One flood per Nile year, reproducible from the seed (the reign id). */
export function drawFloods(seed: string, data: GameData): FloodLevel[] {
  const { floodLowChance, floodHighChance } = data.parameters;
  return Array.from({ length: REIGN_YEARS }, (_, year) => {
    const u = randomUnit(seed, 'flood', year);
    if (u < floodLowChance) {
      return 'low';
    }
    if (u < floodLowChance + floodHighChance) {
      return 'high';
    }
    return 'good';
  });
}
