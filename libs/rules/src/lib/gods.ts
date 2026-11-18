// The five gods. Each favour gauge loses a fixed amount per game hour and is
// fed by staffed temples (continuously) and offerings (once per interval).
// Favour levels are read at the instant something depends on them: harvest,
// house evaluation, card draw.

import type { FloodLevel, GameParameters, God } from '@nomarque/data';
import type { Catalog } from './catalog';
import type { Flows, Workforce } from './economy';
import { isComplete, type NomeState } from './state';

export type GodStanding = 'blessing' | 'neutral' | 'low' | 'veryLow';

export function godStanding(
  state: NomeState,
  params: GameParameters,
  god: God,
): GodStanding {
  const favor = state.rules.gods[god];
  if (favor >= params.godFavorBlessing) {
    return 'blessing';
  }
  if (favor < params.godFavorVeryLow) {
    return 'veryLow';
  }
  if (favor < params.godFavorLow) {
    return 'low';
  }
  return 'neutral';
}

/**
 * Change of every god's favour per game hour: the decay, plus each temple in
 * proportion to its occupancy and to the share of its upkeep it receives.
 */
export function favorRate(
  state: NomeState,
  catalog: Catalog,
  work: Workforce,
  f: Flows,
): number {
  const params = catalog.data.parameters;
  let temples = 0;
  for (const parcel of state.parcels) {
    if (!parcel.building || !isComplete(parcel)) {
      continue;
    }
    if (catalog.building(parcel.building).service !== 'temple') {
      continue;
    }
    const s = work.occupancy.get(parcel.slot) ?? 0;
    temples += s * upkeepShare(f, parcel.slot);
  }
  return params.templeFavorPerHour * temples - params.godFavorDecayPerHour;
}

function upkeepShare(f: Flows, slot: number): number {
  const flow = f.consumers.get(slot);
  if (!flow) {
    return 1;
  }
  let share = 1;
  for (const [resource, demand] of Object.entries(flow.demand)) {
    if (demand > 0) {
      const consumed = flow.consumed[resource as keyof typeof flow.consumed];
      share = Math.min(share, (consumed ?? 0) / demand);
    }
  }
  return share;
}

/**
 * Flood multiplier of the harvest. Hâpy blessing softens a low flood; when he
 * is neglected a high flood loses its bonus.
 */
export function floodMultiplier(
  state: NomeState,
  params: GameParameters,
  flood: FloodLevel,
): number {
  const hapy = godStanding(state, params, 'hapy');
  if (flood === 'low' && hapy === 'blessing') {
    return params.hapyLowFloodMultiplier;
  }
  if (flood === 'high' && (hapy === 'low' || hapy === 'veryLow')) {
    return params.floodMultiplier.good;
  }
  return params.floodMultiplier[flood];
}

/** Osiris adds or removes a share of the harvest. */
export function osirisShare(state: NomeState, params: GameParameters): number {
  const osiris = godStanding(state, params, 'osiris');
  if (osiris === 'blessing') {
    return params.osirisHarvestShare;
  }
  if (osiris === 'low' || osiris === 'veryLow') {
    return -params.osirisHarvestShare;
  }
  return 0;
}

/** Hours of met needs before a block of houses moves up. */
export function upgradeHours(
  state: NomeState,
  params: GameParameters,
  base: number,
): number {
  return godStanding(state, params, 'bastet') === 'blessing'
    ? params.bastetUpgradeHours
    : base;
}
