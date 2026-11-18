import { GAME_DATA, type GameData } from '@nomarque/data';
import { foundNome } from './actions';
import { advance } from './advance';
import { forecast } from './forecast';

// Without cards: a card dealt after the forecast could change the harvest.
const DATA: GameData = { ...GAME_DATA, cards: [] };
const context = {
  data: DATA,
  floods: ['good', 'good', 'good', 'good'] as const,
  seed: 'nome',
};

describe('forecast', () => {
  it('predicts the harvest that advance then delivers', () => {
    const atPeret = advance(foundNome(GAME_DATA), 0, 60, context).state;
    const predicted = forecast(atPeret, DATA, 60, 'good').parcels.find(
      (p) => p.slot === 10,
    );
    const { report } = advance(atPeret, 60, 120, context);
    expect(predicted?.harvest?.wheat).toBeCloseTo(
      report.harvested.wheat ?? 0,
      9,
    );
  });

  it('reports the class workforce and the storage capacity', () => {
    const result = forecast(foundNome(GAME_DATA), GAME_DATA, 50, 'good');
    const { activityRate, baseStorage, granaryCapacity } = GAME_DATA.parameters;
    expect(result.workforce.peasant.available).toBe(
      Math.floor(24 * activityRate),
    );
    expect(result.capacity).toBe(baseStorage + granaryCapacity);
  });
});
