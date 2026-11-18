import { GAME_DATA } from '@nomarque/data';
import { foundNome } from './actions';
import { rankScores, reignScores } from './scoring';

const P = GAME_DATA.parameters;

describe('reign scoring', () => {
  it('values the stocks at their reference price', () => {
    const nome = { ...foundNome(GAME_DATA), deben: 100, stocks: { wheat: 50 } };
    const wheat = GAME_DATA.resources.find((r) => r.id === 'wheat');
    const scores = reignScores(nome, GAME_DATA);
    expect(scores.wealth).toBe(100 + 50 * (wheat?.referencePrice ?? 0));
    expect(scores.piety).toBe(5 * P.godFavorStart);
    expect(scores.royalFavor).toBe(0);
  });

  it('shares ranks on ties and pays prestige by rank', () => {
    const ranked = rankScores(
      [
        { key: 'a', score: 5 },
        { key: 'b', score: 9 },
        { key: 'c', score: 9 },
        { key: 'd', score: 1 },
        { key: 'e', score: 0 },
      ],
      GAME_DATA,
    );
    expect(ranked.map((r) => [r.key, r.rank, r.prestige])).toEqual([
      ['b', 1, P.prestigeFirst],
      ['c', 1, P.prestigeFirst],
      ['a', 3, P.prestigeThird],
      ['d', 4, P.prestigeParticipation],
      ['e', 5, P.prestigeParticipation],
    ]);
  });
});
