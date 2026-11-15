// Game data contract. The JSON files in ../generated are produced by
// `nx run tools:import-data` from data/economie/*.csv and must match these types.
// French labels never live here: they are in ../generated/i18n/fr.json.

export const RESOURCE_IDS = [
  'wheat',
  'barley',
  'flax',
  'papyrus',
  'fish',
  'clay',
  'limestone',
  'bricks',
  'bread',
  'beer',
  'pottery',
  'linen',
  'scrolls',
  'copper',
  'cedar',
  'gold',
  'incense',
] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export const BUILDING_IDS = [
  'farm_wheat',
  'farm_barley',
  'farm_flax',
  'papyrus_marsh',
  'fishery',
  'clay_pit',
  'limestone_quarry',
  'brickworks',
  'bakery',
  'brewery',
  'potter',
  'weaver',
  'scribe_workshop',
  'well',
  'temple',
  'school',
  'local_market',
  'granary',
  'port',
] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];

export const ZONES = ['desert', 'city', 'black_land', 'river'] as const;
export type Zone = (typeof ZONES)[number];

export const WORKER_CLASSES = [
  'peasant',
  'artisan',
  'scribe',
  'priest',
] as const;
export type WorkerClass = (typeof WORKER_CLASSES)[number];

export const SERVICES = [
  'water',
  'temple',
  'school',
  'market',
  'entertainment',
] as const;
export type Service = (typeof SERVICES)[number];

export const HOUSE_IDS = ['hut', 'house', 'scribe_house', 'villa'] as const;
export type HouseId = (typeof HOUSE_IDS)[number];

export const FLOOD_LEVELS = ['low', 'good', 'high'] as const;
export type FloodLevel = (typeof FLOOD_LEVELS)[number];

export const REGIONS = ['upper_egypt', 'middle_egypt', 'delta'] as const;
export type Region = (typeof REGIONS)[number];

/**
 * How a building takes part in production:
 * - field: produces only at harvest (black land crops);
 * - raw: continuous level-1 production without input;
 * - workshop: continuous transformation of inputs into outputs;
 * - service: covers neighbouring parcels with a service, may consume upkeep;
 * - storage: raises storage capacity;
 * - port: enables expeditions and trade.
 */
export type BuildingKind =
  'field' | 'raw' | 'workshop' | 'service' | 'storage' | 'port';

export interface ResourceFlow {
  resource: ResourceId;
  perYear: number;
}

export interface BuildingDef {
  id: BuildingId;
  kind: BuildingKind;
  /** Zones the building may be placed on. */
  zones: Zone[];
  workerClass: WorkerClass;
  workers: number;
  inputs: ResourceFlow[];
  outputs: ResourceFlow[];
  cost: { deben: number };
  /** Construction time in game hours. */
  buildHours: number;
  /** Service provided by the building, if any. */
  service: Service | null;
  /** Coverage range in parcels, null when the building provides no service. */
  range: number | null;
}

export type ResourceTier = 1 | 2 | 'import';

export interface ResourceDef {
  id: ResourceId;
  tier: ResourceTier;
  /** Reference price in deben. */
  referencePrice: number;
  /** Regions that produce it well; empty means everywhere. Imports list none. */
  regions: Region[];
  /** Expedition destination for imports, else null. */
  importFrom: ExpeditionDestinationId | null;
}

export interface HouseNeed {
  resource: ResourceId;
  perInhabitantPerYear: number;
}

export interface HouseDef {
  id: HouseId;
  level: 1 | 2 | 3 | 4;
  inhabitants: number;
  workerClass: WorkerClass;
  taxPerInhabitantPerYear: number;
  needs: HouseNeed[];
  /** Services required, each counted once per entry (villa needs two temples). */
  services: Service[];
  inMvp: boolean;
}

export interface GameParameters {
  /** Share of inhabitants who work. */
  activityRate: number;
  floodMultiplier: Record<FloodLevel, number>;
  /** Floor and ceiling prices as multiples of the reference price. */
  priceFloorFactor: number;
  priceCeilingFactor: number;
  marketTax: number;
  /** Share of harvested cereals owed to the pharaoh. */
  tributeRate: number;
  /** Length of a Nile year in game hours. */
  yearHours: number;
  /** Default server speed (Nile years per real week). */
  defaultSpeed: number;
  catchUpMultiplier: number;
  inactivityDaysBeforeAbandon: number;
  registrationClosesAfterYear: number;
}

export type ExpeditionDestinationId = 'sinai' | 'byblos' | 'nubia' | 'punt';

export interface ExpeditionRouteDef {
  /** e.g. "sinai_safe", "sinai_fast". */
  id: string;
  destination: ExpeditionDestinationId;
  safe: boolean;
  durationHours: number;
  costDeben: number;
  resource: ResourceId;
  quantity: number;
  /** Probability of losing the cargo, 0..1. */
  lossRisk: number;
}

export type CardPhase = 'any' | 'akhet' | 'peret' | 'shemu';
export type God = 'hapy' | 'osiris' | 'thoth' | 'bastet' | 'sekhmet';
export type CardChoiceKey = 'a' | 'b' | 'c';

export interface CardChoiceDef {
  key: CardChoiceKey;
  /**
   * Raw effect text from the spreadsheet. It is structured into typed effects
   * in milestone J2; until then it is kept verbatim (French).
   */
  effectRaw: string;
}

export interface EventCardDef {
  /** e.g. "C01". */
  id: string;
  /** Raw trigger text, structured in J2. */
  triggerRaw: string;
  phase: CardPhase;
  god: God | null;
  choices: CardChoiceDef[];
  defaultChoice: CardChoiceKey;
}

export interface GameData {
  /** Deterministic version: first 12 hex chars of the SHA-256 of the source CSVs. */
  version: string;
  resources: ResourceDef[];
  buildings: BuildingDef[];
  houses: HouseDef[];
  parameters: GameParameters;
  expeditions: ExpeditionRouteDef[];
  cards: EventCardDef[];
}
