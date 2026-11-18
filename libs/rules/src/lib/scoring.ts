// Reign rankings, frozen at the end of the reign. Each ranking scores every
// nome advanced to the end; equal scores share a rank, and each rank earns the
// dynasty some prestige.

import { GODS, type GameData, type ResourceId } from '@nomarque/data';
import type { NomeState } from './state';

export const RANKING_CATEGORIES = ['wealth', 'piety', 'royalFavor'] as const;
export type RankingCategory = (typeof RANKING_CATEGORIES)[number];

export type ReignScores = Record<RankingCategory, number>;

/**
 * - wealth: deben plus the stocks at their reference price;
 * - piety: the favour of the five gods, summed;
 * - royalFavor: the pharaoh's favour.
 */
export function reignScores(state: NomeState, data: GameData): ReignScores {
  const prices = new Map(data.resources.map((r) => [r.id, r.referencePrice]));
  let wealth = state.deben;
  for (const [resource, quantity] of Object.entries(state.stocks) as [
    ResourceId,
    number,
  ][]) {
    wealth += quantity * (prices.get(resource) ?? 0);
  }
  let piety = 0;
  for (const god of GODS) {
    piety += state.rules.gods[god];
  }
  return { wealth, piety, royalFavor: state.favor };
}

export interface RankedEntry<K> {
  key: K;
  score: number;
  /** 1 for the best; equal scores share the rank of the first of them. */
  rank: number;
  prestige: number;
}

/** Ranks entries by descending score; ties share a rank (1, 1, 3). */
export function rankScores<K>(
  entries: readonly { key: K; score: number }[],
  data: GameData,
): RankedEntry<K>[] {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const ranked: RankedEntry<K>[] = [];
  sorted.forEach((entry, index) => {
    const previous = ranked[index - 1];
    const rank =
      previous && previous.score === entry.score ? previous.rank : index + 1;
    ranked.push({ ...entry, rank, prestige: prestigeOf(rank, data) });
  });
  return ranked;
}

function prestigeOf(rank: number, data: GameData): number {
  const p = data.parameters;
  if (rank === 1) {
    return p.prestigeFirst;
  }
  if (rank === 2) {
    return p.prestigeSecond;
  }
  if (rank === 3) {
    return p.prestigeThird;
  }
  return p.prestigeParticipation;
}
