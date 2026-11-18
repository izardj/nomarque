// Mapping from the French labels used in data/economie/*.csv to the stable ids
// of libs/data. The importer must fail on any label missing from these tables.

import type {
  BuildingId,
  BuildingKind,
  CardPhase,
  ExpeditionDestinationId,
  God,
  HouseId,
  Region,
  ResourceId,
  Service,
  WorkerClass,
  Zone,
} from '@nomarque/data';

export const RESOURCE_BY_LABEL: Record<string, ResourceId> = {
  blé: 'wheat',
  orge: 'barley',
  lin: 'flax',
  papyrus: 'papyrus',
  poisson: 'fish',
  argile: 'clay',
  calcaire: 'limestone',
  briques: 'bricks',
  pain: 'bread',
  bière: 'beer',
  poterie: 'pottery',
  'lin tissé': 'linen',
  rouleaux: 'scrolls',
  cuivre: 'copper',
  cèdre: 'cedar',
  or: 'gold',
  encens: 'incense',
};

/** Harvested grains the tribute is levied on ("Part des céréales récoltées"). */
export const CEREAL_RESOURCES: ReadonlySet<ResourceId> = new Set<ResourceId>([
  'wheat',
  'barley',
]);

export interface BuildingMapping {
  id: BuildingId;
  kind: BuildingKind;
  service: Service | null;
}

export const BUILDING_BY_LABEL: Record<string, BuildingMapping> = {
  'Champ de blé': { id: 'farm_wheat', kind: 'field', service: null },
  "Champ d'orge": { id: 'farm_barley', kind: 'field', service: null },
  'Champ de lin': { id: 'farm_flax', kind: 'field', service: null },
  'Marais à papyrus': { id: 'papyrus_marsh', kind: 'raw', service: null },
  Pêcherie: { id: 'fishery', kind: 'raw', service: null },
  "Fosse d'argile": { id: 'clay_pit', kind: 'raw', service: null },
  'Carrière de calcaire': {
    id: 'limestone_quarry',
    kind: 'raw',
    service: null,
  },
  Briqueterie: { id: 'brickworks', kind: 'workshop', service: null },
  Boulangerie: { id: 'bakery', kind: 'workshop', service: null },
  Brasserie: { id: 'brewery', kind: 'workshop', service: null },
  Potier: { id: 'potter', kind: 'workshop', service: null },
  Tisserand: { id: 'weaver', kind: 'workshop', service: null },
  'Atelier de scribe': {
    id: 'scribe_workshop',
    kind: 'workshop',
    service: null,
  },
  Puits: { id: 'well', kind: 'service', service: 'water' },
  Temple: { id: 'temple', kind: 'service', service: 'temple' },
  École: { id: 'school', kind: 'service', service: 'school' },
  'Marché local': { id: 'local_market', kind: 'service', service: 'market' },
  Grenier: { id: 'granary', kind: 'storage', service: null },
  Port: { id: 'port', kind: 'port', service: null },
};

/**
 * "Rive" (bank) is not one of the four zones of the art direction. Pending a
 * game-design decision it maps to the river zone.
 */
export const ZONES_BY_LABEL: Record<string, Zone[]> = {
  Désert: ['desert'],
  Ville: ['city'],
  'Terre noire': ['black_land'],
  Fleuve: ['river'],
  Rive: ['river'],
};

export const WORKER_CLASS_BY_LABEL: Record<string, WorkerClass> = {
  Paysans: 'peasant',
  Artisans: 'artisan',
  Scribes: 'scribe',
  Prêtres: 'priest',
};

export const HOUSE_BY_LABEL: Record<string, HouseId> = {
  Hutte: 'hut',
  Maison: 'house',
  'Maison de scribe': 'scribe_house',
  Villa: 'villa',
};

export const SERVICE_BY_LABEL: Record<string, Service> = {
  eau: 'water',
  temple: 'temple',
  école: 'school',
  marché: 'market',
  divertissement: 'entertainment',
};

/** Values of the "region" column of ressources.csv. "Partout" means everywhere. */
export const REGION_BY_LABEL: Record<string, Region> = {
  'Haute-Égypte': 'upper_egypt',
  'Moyenne-Égypte': 'middle_egypt',
  Delta: 'delta',
};

export const DESTINATION_BY_LABEL: Record<string, ExpeditionDestinationId> = {
  Sinaï: 'sinai',
  Byblos: 'byblos',
  Nubie: 'nubia',
  Pount: 'punt',
};

export const CARD_PHASE_BY_LABEL: Record<string, CardPhase> = {
  Toutes: 'any',
  Akhet: 'akhet',
  Peret: 'peret',
  Shemu: 'shemu',
};

export const GOD_BY_LABEL: Record<string, God> = {
  Hâpy: 'hapy',
  Osiris: 'osiris',
  Thot: 'thoth',
  Bastet: 'bastet',
  Sekhmet: 'sekhmet',
};

/** Rows of parametres.csv, by their "parametre" label. */
export const PARAMETER_BY_LABEL = {
  "Taux d'activité": 'activityRate',
  'Multiplicateur crue basse': 'floodMultiplier.low',
  'Multiplicateur crue bonne': 'floodMultiplier.good',
  'Multiplicateur crue haute': 'floodMultiplier.high',
  'Prix plancher (× prix réf.)': 'priceFloorFactor',
  'Prix plafond (× prix réf.)': 'priceCeilingFactor',
  'Taxe de marché': 'marketTax',
  'Tribut au pharaon': 'tributeRate',
  "Durée d'une année du Nil (h de jeu)": 'yearHours',
  'Vitesse du serveur': 'defaultSpeed',
  'Rattrapage (multiplicateur)': 'catchUpMultiplier',
  'Inactivité avant abandon (jours réels)': 'inactivityDaysBeforeAbandon',
  "Inscription fermée après l'année": 'registrationClosesAfterYear',
  'Stockage de base par ressource': 'baseStorage',
  "Capacité d'un grenier par ressource": 'granaryCapacity',
  'Maisons par îlot': 'housesPerBlock',
  "Coût d'un îlot de maisons (deben)": 'houseBlockCost.deben',
  "Durée de construction d'un îlot (h de jeu)": 'houseBlockBuildHours',
  'Deben de départ': 'startingDeben',
  /** Comma-separated zone labels, parsed with ZONES_BY_LABEL. */
  'Zones des îlots de maisons': 'houseZones',
  'Faveur des dieux au départ': 'godFavorStart',
  'Faveur des dieux maximale': 'godFavorMax',
  'Baisse de faveur des dieux (par h de jeu)': 'godFavorDecayPerHour',
  "Faveur d'un temple actif (par h de jeu et par dieu)": 'templeFavorPerHour',
  'Seuil de faveur basse': 'godFavorLow',
  'Seuil de faveur très basse': 'godFavorVeryLow',
  'Seuil de bénédiction': 'godFavorBlessing',
  'Intervalle entre offrandes (h de jeu)': 'offeringIntervalHours',
  'Hâpy : multiplicateur de crue basse bénie': 'hapyLowFloodMultiplier',
  'Osiris : effet sur la récolte': 'osirisHarvestShare',
  'Bastet : heures avant montée de niveau (béni)': 'bastetUpgradeHours',
  'Intervalle de tirage des cartes (h de jeu)': 'cardDrawIntervalHours',
  "Probabilité d'une carte par tirage": 'cardDrawChance',
  'Cartes en attente au maximum': 'cardMaxPending',
  'Délai avant le choix par défaut (h de jeu)': 'cardGraceHours',
  "Poids d'une carte conditionnelle": 'cardConditionalWeight',
  "Poids d'une carte rare": 'cardRareWeight',
  'Seuil de faveur royale élevée': 'royalFavorHigh',
  'Faveur royale par unité de tribut': 'royalFavorPerTribute',
  'Faveur royale perdue par unité de tribut manquante':
    'royalFavorPerMissingTribute',
} as const;

/**
 * Worker classes as card effects name them ("paysans -10 pendant 48 h"),
 * lower case and plural.
 */
export const CARD_WORKER_CLASS_BY_LABEL: Record<string, WorkerClass> = {
  paysans: 'peasant',
  artisans: 'artisan',
  scribes: 'scribe',
  prêtres: 'priest',
};

/**
 * Buildings as card texts name them, in effects ("carrière inactive 24 h") and
 * in triggers ("Carrière construite"). Matched case-insensitively.
 */
export const CARD_BUILDING_BY_LABEL: Record<string, BuildingId> = {
  carrière: 'limestone_quarry',
  port: 'port',
  pêcherie: 'fishery',
  grenier: 'granary',
  potier: 'potter',
  temple: 'temple',
  école: 'school',
  "champ d'orge": 'farm_barley',
};
