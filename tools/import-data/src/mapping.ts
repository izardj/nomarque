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
} as const;
