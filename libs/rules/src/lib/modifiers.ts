// Lasting card effects. A modifier is active on [startsAt, endsAt); both ends
// are discrete events of advance, so rates stay constant between events.

import type { ResourceId, WorkerClass } from '@nomarque/data';
import type { Catalog } from './catalog';
import type { Modifier, NomeState, ParcelState } from './state';

export function activeModifiers(state: NomeState, at: number): Modifier[] {
  return state.rules.modifiers.filter((m) => m.startsAt <= at && at < m.endsAt);
}

/** Available workers of a class after the card effects. */
export function adjustAvailable(
  base: number,
  workerClass: WorkerClass,
  active: readonly Modifier[],
): number {
  let percent = 0;
  let count = 0;
  for (const { effect } of active) {
    if (
      effect.kind !== 'workforce' ||
      (effect.workerClass !== 'all' && effect.workerClass !== workerClass)
    ) {
      continue;
    }
    if ('percent' in effect.change) {
      percent += effect.change.percent;
    } else {
      count += effect.change.count;
    }
  }
  return Math.max(0, Math.floor(base * factor(percent)) + count);
}

/**
 * Share of its occupancy a building keeps under `idle` effects. Storage is
 * passive: an idle granary keeps its capacity.
 */
export function idleFactor(
  parcel: ParcelState,
  catalog: Catalog,
  active: readonly Modifier[],
): number {
  if (!parcel.building) {
    return 1;
  }
  const def = catalog.building(parcel.building);
  if (def.kind === 'storage') {
    return 1;
  }
  let percent = 0;
  for (const { effect } of active) {
    if (effect.kind !== 'idle') {
      continue;
    }
    const target = effect.target;
    const hit =
      (target.kind === 'building' && target.building === def.id) ||
      (target.kind === 'fields' && def.kind === 'field') ||
      (target.kind === 'zone' &&
        catalog.slot(parcel.slot).zone === target.zone);
    if (hit) {
      percent += effect.percent;
    }
  }
  return factor(percent);
}

/** Multiplier on the output of a resource by raw buildings and workshops. */
export function productionFactor(
  resource: ResourceId,
  active: readonly Modifier[],
): number {
  let percent = 0;
  for (const { effect } of active) {
    if (effect.kind === 'production' && effect.resource === resource) {
      percent += effect.percent;
    }
  }
  return factor(percent);
}

/** Multiplier on what houses consume of a resource. */
export function consumptionFactor(
  resource: ResourceId,
  active: readonly Modifier[],
): number {
  let percent = 0;
  for (const { effect } of active) {
    if (effect.kind === 'consumption' && effect.resource === resource) {
      percent += effect.percent;
    }
  }
  return factor(percent);
}

export type UpgradeMode = 'normal' | 'blocked' | 'fast';

/** A block on house upgrades wins over a speed-up. */
export function upgradeMode(active: readonly Modifier[]): UpgradeMode {
  let mode: UpgradeMode = 'normal';
  for (const { effect } of active) {
    if (effect.kind !== 'houseUpgrade') {
      continue;
    }
    if (effect.mode === 'blocked') {
      return 'blocked';
    }
    mode = 'fast';
  }
  return mode;
}

/** 1 + percent / 100, never negative. */
export function factor(percent: number): number {
  return Math.max(0, 1 + percent / 100);
}
