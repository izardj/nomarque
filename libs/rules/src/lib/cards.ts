// Event cards. Draws happen at fixed instants of the game (every
// cardDrawIntervalHours); each one is seeded by the nome and the draw number,
// so the cards dealt never depend on when the player logs in. A dealt card
// waits for a choice; at its expiry the default choice applies.

import {
  GODS,
  type CardChoiceKey,
  type CardEffect,
  type CardTrigger,
  type EventCardDef,
  type ResourceId,
} from '@nomarque/data';
import { NILE_CALENDAR, phaseAt } from './calendar';
import type { Catalog } from './catalog';
import { STOCK_EPSILON, storageCapacity, workforce } from './economy';
import { godStanding } from './gods';
import { randomUnit } from './random';
import { addAmount, type AdvanceReport } from './report';
import {
  isComplete,
  type NomeState,
  type PendingCard,
  type RulesContext,
  type TimedEffect,
} from './state';

/** Hours after the start of a phase during which "Début d'…" cards apply. */
const PHASE_START_HOURS = 24;

export function nextDrawAfter(t: number, interval: number): number {
  return (Math.floor(t / interval) + 1) * interval;
}

export function isDrawInstant(t: number, interval: number): boolean {
  return Number.isInteger(t / interval);
}

/** Deals a card at the draw instant t when one is due. */
export function drawCard(
  state: NomeState,
  t: number,
  context: RulesContext,
  report: AdvanceReport,
): void {
  const params = context.data.parameters;
  const cards = state.rules.cards;
  if (cards.pending.length >= params.cardMaxPending) {
    return;
  }
  const drawId = Math.round(t / params.cardDrawIntervalHours);
  if (randomUnit(context.seed, 'draw', drawId) >= params.cardDrawChance) {
    return;
  }
  const weighted: [EventCardDef, number][] = [];
  for (const card of context.data.cards) {
    const weight = drawWeight(card, state, t, context);
    if (weight > 0) {
      weighted.push([card, weight]);
    }
  }
  const total = weighted.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) {
    return;
  }
  let pick = randomUnit(context.seed, 'card', drawId) * total;
  let chosen = weighted[weighted.length - 1][0];
  for (const [card, weight] of weighted) {
    if (pick < weight) {
      chosen = card;
      break;
    }
    pick -= weight;
  }
  cards.pending.push({
    drawId,
    cardId: chosen.id,
    drawnAt: t,
    expiresAt: t + params.cardGraceHours,
  });
  cards.dealtThisYear.push(chosen.id);
  report.cardsDealt.push({ drawId, cardId: chosen.id, at: t });
}

/** Draw weight of a card at instant t; 0 when it cannot be dealt. */
export function drawWeight(
  card: EventCardDef,
  state: NomeState,
  t: number,
  context: RulesContext,
): number {
  const params = context.data.parameters;
  const { phase, hourOfYear } = phaseAt(t, params.yearHours);
  if (card.phase !== 'any' && card.phase !== phase) {
    return 0;
  }
  const cards = state.rules.cards;
  if (
    cards.dealtThisYear.includes(card.id) ||
    cards.pending.some((p) => p.cardId === card.id)
  ) {
    return 0;
  }
  const trigger = card.trigger;
  if (trigger.kind === 'random') {
    return 1;
  }
  if (trigger.kind === 'rare') {
    return params.cardRareWeight;
  }
  return isTriggered(trigger, state, t, hourOfYear, context)
    ? params.cardConditionalWeight
    : 0;
}

function isTriggered(
  trigger: CardTrigger,
  state: NomeState,
  t: number,
  hourOfYear: number,
  context: RulesContext,
): boolean {
  const params = context.data.parameters;
  switch (trigger.kind) {
    case 'random':
    case 'rare':
      return true;
    case 'tutorial':
    case 'priceAbove':
      // Dealt by the tutorial (J4) and the market (J3).
      return false;
    case 'stockAbove':
      return (state.stocks[trigger.resource] ?? 0) > trigger.quantity;
    case 'godFavorBelow': {
      const standing = godStanding(state, params, trigger.god);
      return trigger.level === 'veryLow'
        ? standing === 'veryLow'
        : standing === 'low' || standing === 'veryLow';
    }
    case 'royalFavorHigh':
      return state.favor >= params.royalFavorHigh;
    case 'flood': {
      const year = phaseAt(t, params.yearHours).year;
      return context.floods[year] === trigger.level;
    }
    case 'phaseStart':
      return hourOfYear - phaseStartHour(hourOfYear) < PHASE_START_HOURS;
    case 'beforeTribute':
      return (
        hourOfYear >= NILE_CALENDAR.peretEndsAt &&
        hourOfYear < NILE_CALENDAR.tributeAt
      );
    case 'built':
      return state.parcels.some(
        (p) => p.building === trigger.building && isComplete(p),
      );
    case 'housesAtLeast': {
      let houses = 0;
      for (const parcel of state.parcels) {
        if (parcel.houses && isComplete(parcel)) {
          houses += parcel.houses.count;
        }
      }
      return houses >= trigger.count;
    }
    case 'busyWorkers':
      return state.rules.busyHours[trigger.workerClass] >= trigger.hours;
  }
  return assertNever(trigger);
}

function phaseStartHour(hourOfYear: number): number {
  if (hourOfYear < NILE_CALENDAR.akhetEndsAt) {
    return 0;
  }
  if (hourOfYear < NILE_CALENDAR.peretEndsAt) {
    return NILE_CALENDAR.akhetEndsAt;
  }
  return NILE_CALENDAR.peretEndsAt;
}

export type ChoiceError = 'unknown_card' | 'unknown_choice' | 'cannot_afford';

/**
 * Applies a choice of a pending card at instant t and removes the card. With
 * `strict`, a choice whose costs exceed the stocks or the deben is refused;
 * otherwise (default choice) the costs are capped at what the nome holds.
 */
export function applyChoice(
  state: NomeState,
  drawId: number,
  key: CardChoiceKey,
  t: number,
  context: RulesContext,
  catalog: Catalog,
  strict: boolean,
  report?: AdvanceReport,
): ChoiceError | null {
  const cards = state.rules.cards;
  const index = cards.pending.findIndex((p) => p.drawId === drawId);
  if (index < 0) {
    return 'unknown_card';
  }
  const pending: PendingCard = cards.pending[index];
  const card = context.data.cards.find((c) => c.id === pending.cardId);
  const choice = card?.choices.find((c) => c.key === key);
  if (!card || !choice) {
    return 'unknown_choice';
  }
  if (strict && !canAffordEffects(state, choice.effects)) {
    return 'cannot_afford';
  }
  cards.pending.splice(index, 1);
  choice.effects.forEach((effect, i) =>
    applyEffect(state, effect, t, context, [drawId, key, i]),
  );
  clampToCapacity(state, t, catalog, report);
  return null;
}

/** Resources and deben a choice takes for sure (chances excluded). */
export function canAffordEffects(
  state: NomeState,
  effects: readonly CardEffect[],
): boolean {
  const costs: Partial<Record<ResourceId, number>> = {};
  let deben = 0;
  for (const effect of effects) {
    if (effect.kind === 'resource' && effect.amount < 0) {
      addAmount(costs, effect.resource, -effect.amount);
    } else if (effect.kind === 'deben' && effect.amount < 0) {
      deben -= effect.amount;
    }
  }
  if (deben > state.deben + STOCK_EPSILON) {
    return false;
  }
  return Object.entries(costs).every(
    ([resource, cost]) =>
      (state.stocks[resource as ResourceId] ?? 0) + STOCK_EPSILON >= cost,
  );
}

function applyEffect(
  state: NomeState,
  effect: CardEffect,
  t: number,
  context: RulesContext,
  key: (string | number)[],
): void {
  const rules = state.rules;
  const params = context.data.parameters;
  switch (effect.kind) {
    case 'resource': {
      const stock = state.stocks[effect.resource] ?? 0;
      state.stocks[effect.resource] = Math.max(0, stock + effect.amount);
      return;
    }
    case 'resourceShare': {
      const stock = state.stocks[effect.resource] ?? 0;
      state.stocks[effect.resource] = Math.max(
        0,
        stock * (1 + effect.percent / 100),
      );
      return;
    }
    case 'deben':
      state.deben = Math.max(0, state.deben + effect.amount);
      return;
    case 'royalFavor':
      state.favor = Math.max(0, state.favor + effect.amount);
      return;
    case 'godFavor': {
      const gods = effect.god === 'all' ? GODS : [effect.god];
      for (const god of gods) {
        rules.gods[god] = Math.min(
          params.godFavorMax,
          Math.max(0, rules.gods[god] + effect.amount),
        );
      }
      return;
    }
    case 'population':
      rules.population[effect.workerClass] += effect.amount;
      return;
    case 'harvest':
      rules.harvestPercent += effect.percent;
      return;
    case 'tribute':
      rules.tributePercent += effect.percent;
      return;
    case 'floodForecast':
      rules.floodForecastHours = Math.max(
        rules.floodForecastHours,
        effect.hours,
      );
      return;
    case 'chance':
      if (randomUnit(context.seed, 'chance', ...key) < effect.probability) {
        applyEffect(state, effect.effect, t, context, [...key, 'then']);
      }
      return;
    case 'workforce':
    case 'idle':
    case 'consumption':
    case 'houseUpgrade':
    case 'production':
      addModifier(state, effect, t, params.yearHours);
      return;
  }
  assertNever(effect);
}

function addModifier(
  state: NomeState,
  effect: TimedEffect,
  t: number,
  yearHours: number,
): void {
  const startsAt = effect.kind === 'production' ? t + effect.startsAfter : t;
  const endsAt =
    effect.kind === 'production' && effect.hours === 'year'
      ? (phaseAt(t, yearHours).year + 1) * yearHours
      : startsAt + (effect.hours as number);
  if (endsAt <= startsAt) {
    return;
  }
  state.rules.modifiers.push({ effect, startsAt, endsAt });
  state.rules.modifiers.sort((a, b) => a.startsAt - b.startsAt);
}

function clampToCapacity(
  state: NomeState,
  t: number,
  catalog: Catalog,
  report?: AdvanceReport,
): void {
  const capacity = storageCapacity(
    state,
    catalog,
    workforce(state, catalog, t),
  );
  for (const resource of catalog.resourceOrder) {
    const stock = state.stocks[resource] ?? 0;
    if (stock > capacity) {
      if (report) {
        addAmount(report.lost, resource, stock - capacity);
      }
      state.stocks[resource] = capacity;
    }
  }
}

function assertNever(value: never): never {
  throw new Error(`unexpected ${JSON.stringify(value)}`);
}
