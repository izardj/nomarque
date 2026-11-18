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
  /** Cereals are the harvested grains the pharaoh's tribute is levied on. */
  cereal: boolean;
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
  /** Storage capacity per resource without any granary. */
  baseStorage: number;
  /** Storage capacity per resource added by a fully staffed granary. */
  granaryCapacity: number;
  /** Houses in a block built on one parcel. */
  housesPerBlock: number;
  houseBlockCost: { deben: number };
  /** Construction time of a block of houses, in game hours. */
  houseBlockBuildHours: number;
  /** Zones a block of houses may be built on. */
  houseZones: Zone[];
  startingDeben: number;
  /** Gods: favour gauge from 0 to godFavorMax. */
  godFavorStart: number;
  godFavorMax: number;
  /** Continuous loss of favour per game hour, for every god. */
  godFavorDecayPerHour: number;
  /** Favour per game hour that a fully staffed temple gives every god. */
  templeFavorPerHour: number;
  /** Below: the god is neglected ("basse") / angry ("très basse"). */
  godFavorLow: number;
  godFavorVeryLow: number;
  /** At or above: the god blesses the nome. */
  godFavorBlessing: number;
  /** Game hours between two offerings. */
  offeringIntervalHours: number;
  /** Hâpy's blessing: flood multiplier of a low flood. */
  hapyLowFloodMultiplier: number;
  /** Osiris: harvest bonus when blessed, malus when neglected (0.1 = 10 %). */
  osirisHarvestShare: number;
  /** Bastet's blessing: hours of met needs before a house moves up. */
  bastetUpgradeHours: number;
  /** Event cards: game hours between two draws. */
  cardDrawIntervalHours: number;
  /** Probability that a draw deals a card. */
  cardDrawChance: number;
  /** Cards waiting for a choice, at most. */
  cardMaxPending: number;
  /** Game hours before the default choice applies. */
  cardGraceHours: number;
  /** Draw weight of a card with a state trigger; a random card weighs 1. */
  cardConditionalWeight: number;
  /** Draw weight of a rare card. */
  cardRareWeight: number;
  /** Pharaoh's favour: "élevée" from this value. */
  royalFavorHigh: number;
  /** Pharaoh's favour per unit of tribute paid, lost per unit missing. */
  royalFavorPerTribute: number;
  royalFavorPerMissingTribute: number;
  /** Prestige a dynasty earns per ranking of the reign, by rank. */
  prestigeFirst: number;
  prestigeSecond: number;
  prestigeThird: number;
  /** Prestige for any other rank. */
  prestigeParticipation: number;
  /** Chance of each flood level per Nile year; a good flood otherwise. */
  floodLowChance: number;
  floodHighChance: number;
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

export const GODS = ['hapy', 'osiris', 'thoth', 'bastet', 'sekhmet'] as const;
export type God = (typeof GODS)[number];

export type CardChoiceKey = 'a' | 'b' | 'c';

/** Parcels hit by an `idle` effect. */
export type CardTarget =
  | { kind: 'building'; building: BuildingId }
  | { kind: 'zone'; zone: Zone }
  | { kind: 'fields' };

/**
 * One structured effect of a card choice, parsed from the spreadsheet text.
 * Amounts are signed: negative is a cost or a malus. Percentages are signed
 * percent points (-20 means -20 %). Durations are in game hours.
 */
export type CardEffect =
  /** "blé +30", "poisson -5". */
  | { kind: 'resource'; resource: ResourceId; amount: number }
  /** "blé -10 %": a share of the current stock. */
  | { kind: 'resourceShare'; resource: ResourceId; percent: number }
  /** "deben -30". */
  | { kind: 'deben'; amount: number }
  /** "faveur +20": the pharaoh's favour. */
  | { kind: 'royalFavor'; amount: number }
  /** "Bastet +10", "tous les dieux +5" (god: 'all'). */
  | { kind: 'godFavor'; god: God | 'all'; amount: number }
  /** "scribes -1", "paysans +1": permanent change of the available workers. */
  | { kind: 'population'; workerClass: WorkerClass; amount: number }
  /**
   * Temporary change of the available workers of a class, by a percentage
   * ("paysans -20 % pendant 24 h", "scribes inactifs 12 h" = -100 %) or by a
   * count ("paysans -10 pendant 48 h"). "production -N % pendant H h" hits
   * every class: workerClass 'all'.
   */
  | {
      kind: 'workforce';
      workerClass: WorkerClass | 'all';
      change: { percent: number } | { count: number };
      hours: number;
    }
  /**
   * Buildings working below their staffing: "carrière inactive 24 h"
   * (percent -100), "ouvriers des champs -50 % 12 h" (percent -50).
   */
  | { kind: 'idle'; target: CardTarget; percent: number; hours: number }
  /**
   * Output bonus on a resource: "poterie +20 % jusqu'à la fin de l'année"
   * (hours: 'year'), "puis poisson +30 % 24 h" (startsAfter: 6).
   */
  | {
      kind: 'production';
      resource: ResourceId;
      percent: number;
      hours: number | 'year';
      startsAfter: number;
    }
  /** "conso de blé -20 % 48 h": houses consume less of a resource. */
  | {
      kind: 'consumption';
      resource: ResourceId;
      percent: number;
      hours: number;
    }
  /** "récolte -15 %": this year's harvest. */
  | { kind: 'harvest'; percent: number }
  /** "tribut -10 %": this year's tribute. */
  | { kind: 'tribute'; percent: number }
  /** "maisons : montée de niveau bloquée 24 h" / "accélérée 24 h". */
  | { kind: 'houseUpgrade'; mode: 'blocked' | 'fast'; hours: number }
  /** "prochaine crue révélée 6 h en avance". */
  | { kind: 'floodForecast'; hours: number }
  /** "50 % : récolte -15 %": the effect applies with this probability. */
  | { kind: 'chance'; probability: number; effect: CardEffect };

export type CardEffectKind = CardEffect['kind'];

/** What makes a card eligible at a draw. */
export type CardTrigger =
  /** "Aléatoire", "Une fois par année". */
  | { kind: 'random' }
  /** "Rare": eligible like a random card, with a lower weight. */
  | { kind: 'rare' }
  /** "Tutoriel (mission 3)": never drawn, the tutorial deals it (J4). */
  | { kind: 'tutorial' }
  /** "Stock de blé > 200". */
  | { kind: 'stockAbove'; resource: ResourceId; quantity: number }
  /** "Faveur de Bastet basse" / "très basse". */
  | { kind: 'godFavorBelow'; god: God; level: 'low' | 'veryLow' }
  /** "Faveur royale élevée". */
  | { kind: 'royalFavorHigh' }
  /** "Crue basse": this year's flood. */
  | { kind: 'flood'; level: FloodLevel }
  /** "Début d'Akhet": the first 24 hours of the card's phase. */
  | { kind: 'phaseStart' }
  /** "Avant le tribut": Shemu, before the tribute is levied. */
  | { kind: 'beforeTribute' }
  /** "Port construit", "Champ d'orge construit": a finished building. */
  | { kind: 'built'; building: BuildingId }
  /** "3 maisons ou plus": houses counted one by one, not blocks. */
  | { kind: 'housesAtLeast'; count: number }
  /** "Paysans occupés à 100 % depuis 48 h". */
  | { kind: 'busyWorkers'; workerClass: WorkerClass; hours: number }
  /** "Prix du pain > prix réf. × 1,4": needs the market (J3). */
  | { kind: 'priceAbove'; resource: ResourceId; factor: number };

export interface CardChoiceDef {
  key: CardChoiceKey;
  /** Spreadsheet text of the effects (French), shown as the visible cost. */
  effectRaw: string;
  /** Structured effects, in the order of the text. Empty for "rien". */
  effects: CardEffect[];
}

export interface EventCardDef {
  /** e.g. "C01". */
  id: string;
  /** Spreadsheet text of the trigger (French). */
  triggerRaw: string;
  trigger: CardTrigger;
  phase: CardPhase;
  god: God | null;
  choices: CardChoiceDef[];
  defaultChoice: CardChoiceKey;
}

export interface GodDef {
  id: God;
  /** What one offering to this god costs. */
  offering: { resource: ResourceId; quantity: number };
  /** Favour gained by one offering. */
  favorPerOffering: number;
}

/** What a parcel of the starting map holds when a nome is founded. */
export type StartingContent =
  | { kind: 'building'; building: BuildingId }
  | { kind: 'houses'; house: HouseId };

/** One parcel of the nome map. Rows and columns drive service coverage. */
export interface MapSlotDef {
  slot: number;
  row: number;
  col: number;
  zone: Zone;
  /** Null when the parcel starts empty. */
  start: StartingContent | null;
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
  gods: GodDef[];
  /** Map of a nome, ordered by slot; slots are 0..n-1. */
  map: MapSlotDef[];
  /** Stocks a nome starts with; missing resources start at 0. */
  startingStocks: Partial<Record<ResourceId, number>>;
}
