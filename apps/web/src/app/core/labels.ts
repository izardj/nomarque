import type { ParcelDto, ResourceAmountsDto } from '@nomarque/contracts';
import {
  type BuildingDef,
  type BuildingId,
  type CardChoiceKey,
  type EventCardDef,
  FR_LABELS,
  GAME_DATA,
  type HouseDef,
  type ResourceId,
} from '@nomarque/data';

import { fr } from '../i18n/fr';

const numberFormat = new Intl.NumberFormat('fr-FR');

/** A whole number with French thousands separators. */
export function formatNumber(value: number): string {
  return numberFormat.format(Math.round(value));
}

/** Plural of a label: the head noun takes the `s` ("Maison de scribe"). */
export function plural(label: string, count: number): string {
  if (count < 2) {
    return label;
  }
  const [head, ...tail] = label.split(' de ');
  const noun = tail.length > 0 ? head : label;
  const pluralNoun = /[sxz]$/.test(noun) ? noun : `${noun}s`;
  return tail.length > 0 ? [pluralNoun, ...tail].join(' de ') : pluralNoun;
}

export function resourceLabel(resource: ResourceId): string {
  return FR_LABELS.resources[resource];
}

export function buildingLabel(building: BuildingId): string {
  return FR_LABELS.buildings[building];
}

export function buildingDef(building: BuildingId): BuildingDef {
  const def = GAME_DATA.buildings.find(
    (candidate) => candidate.id === building,
  );
  if (def === undefined) {
    throw new Error(`Unknown building: ${building}`);
  }
  return def;
}

export function houseDef(level: number): HouseDef {
  const def = GAME_DATA.houses.find((candidate) => candidate.level === level);
  if (def === undefined) {
    throw new Error(`Unknown house level: ${level}`);
  }
  return def;
}

/** "Huttes" for a block of huts, "Maison" for a single house. */
export function housesLabel(level: number, count: number): string {
  return plural(FR_LABELS.houses[houseDef(level).id], count);
}

/** What stands on a parcel, in French; null when the parcel is empty. */
export function parcelName(parcel: ParcelDto): string | null {
  if (parcel.building !== null) {
    return buildingLabel(parcel.building);
  }
  if (parcel.houses !== null) {
    return `${housesLabel(parcel.houses.level, parcel.houses.count)} ×${parcel.houses.count}`;
  }
  return null;
}

/** The texts of an event card, as written in the card spreadsheet. */
export interface CardTexts {
  title: string;
  text: string;
  choices: Partial<Record<CardChoiceKey, { label: string; effect: string }>>;
}

const CARD_TEXTS: Readonly<Record<string, CardTexts>> = FR_LABELS.cards;

export function cardTexts(cardId: string): CardTexts {
  const texts = CARD_TEXTS[cardId];
  if (texts === undefined) {
    throw new Error(`Unknown card: ${cardId}`);
  }
  return texts;
}

export function cardDef(cardId: string): EventCardDef {
  const def = GAME_DATA.cards.find((candidate) => candidate.id === cardId);
  if (def === undefined) {
    throw new Error(`Unknown card: ${cardId}`);
  }
  return def;
}

export interface AmountEntry {
  resource: ResourceId;
  /** Rounded quantity, never zero. */
  quantity: number;
}

/** The resources of an amount map whose rounded quantity is not zero. */
export function amountEntries(
  amounts: ResourceAmountsDto | null | undefined,
): AmountEntry[] {
  const entries: AmountEntry[] = [];
  for (const resource of Object.keys(amounts ?? {}) as ResourceId[]) {
    const quantity = Math.round(amounts?.[resource] ?? 0);
    if (quantity !== 0) {
      entries.push({ resource, quantity });
    }
  }
  return entries;
}

/** Agrees a participle with the gender and number of a resource. */
export function agree(
  participle: string,
  resource: ResourceId,
  count: number,
): string {
  const feminine = fr.resourceGender[resource] === 'f' ? 'e' : '';
  const pluralMark = count > 1 ? 's' : '';
  return `${participle}${feminine}${pluralMark}`;
}

/** "2 h 10", "45 min": the time left before an instant; null once past. */
export function formatRemaining(untilMs: number, nowMs: number): string | null {
  const minutes = Math.ceil((untilMs - nowMs) / 60_000);
  if (minutes <= 0) {
    return null;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0
    ? `${hours} h`
    : `${hours} h ${String(rest).padStart(2, '0')}`;
}
