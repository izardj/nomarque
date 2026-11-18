// Pure CSV parsers. Each function takes the raw contents of one or more CSV
// files and returns typed game data plus the French labels needed by the UI.
// Any label missing from mapping.ts raises an explicit ImportDataError.

import type {
  BuildingDef,
  CardChoiceKey,
  CardEffect,
  CardPhase,
  CardTrigger,
  EventCardDef,
  ExpeditionDestinationId,
  ExpeditionRouteDef,
  GameParameters,
  God,
  GodDef,
  HouseDef,
  HouseId,
  HouseNeed,
  MapSlotDef,
  ResourceDef,
  ResourceFlow,
  ResourceId,
  ResourceTier,
  Service,
  StartingContent,
  Zone,
} from '@nomarque/data';
import { GODS } from '@nomarque/data';
import { parse } from 'csv-parse/sync';
import {
  BUILDING_BY_LABEL,
  CARD_BUILDING_BY_LABEL,
  CARD_PHASE_BY_LABEL,
  CARD_WORKER_CLASS_BY_LABEL,
  CEREAL_RESOURCES,
  DESTINATION_BY_LABEL,
  GOD_BY_LABEL,
  HOUSE_BY_LABEL,
  PARAMETER_BY_LABEL,
  REGION_BY_LABEL,
  RESOURCE_BY_LABEL,
  SERVICE_BY_LABEL,
  WORKER_CLASS_BY_LABEL,
  ZONES_BY_LABEL,
} from './mapping';

export class ImportDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportDataError';
  }
}

interface CsvRow {
  values: Record<string, string>;
  line: number;
}

function readRows(fileName: string, text: string): CsvRow[] {
  const records = parse<Record<string, string>>(text, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
    record_delimiter: ['\r\n', '\n'],
  });
  return records.map((values, index) => ({ values, line: index + 2 }));
}

function fail(fileName: string, line: number, message: string): never {
  throw new ImportDataError(`${fileName}:${line}: ${message}`);
}

function requireCell(row: CsvRow, fileName: string, column: string): string {
  const value = row.values[column] ?? '';
  if (value === '') {
    fail(fileName, row.line, `missing value for column "${column}"`);
  }
  return value;
}

function parseNumber(row: CsvRow, fileName: string, column: string): number {
  const raw = requireCell(row, fileName, column);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    fail(fileName, row.line, `"${raw}" in column "${column}" is not a number`);
  }
  return value;
}

function lookup<T>(
  table: Record<string, T>,
  fileName: string,
  row: CsvRow,
  column: string,
  value: string,
): T {
  if (!Object.prototype.hasOwnProperty.call(table, value)) {
    fail(
      fileName,
      row.line,
      `unknown ${column} label "${value}" in column "${column}"`,
    );
  }
  return table[value] as T;
}

/** Case-insensitive lookup used by the card grammar. */
function findLabel<T>(table: Record<string, T>, label: string): T | undefined {
  if (Object.prototype.hasOwnProperty.call(table, label)) {
    return table[label] as T;
  }
  const wanted = label.toLowerCase();
  for (const [key, value] of Object.entries(table)) {
    if (key.toLowerCase() === wanted) {
      return value;
    }
  }
  return undefined;
}

function parseFlows(
  row: CsvRow,
  fileName: string,
  resourceColumn: string,
  quantityColumn: string,
): ResourceFlow[] {
  const label = row.values[resourceColumn] ?? '';
  if (label === '') {
    const quantity = row.values[quantityColumn] ?? '';
    if (quantity !== '') {
      fail(
        fileName,
        row.line,
        `column "${quantityColumn}" has a value but "${resourceColumn}" is empty`,
      );
    }
    return [];
  }
  return [
    {
      resource: lookup(RESOURCE_BY_LABEL, fileName, row, 'resource', label),
      perYear: parseNumber(row, fileName, quantityColumn),
    },
  ];
}

export interface ParsedResources {
  resources: ResourceDef[];
  labels: Record<string, string>;
}

export function parseResources(text: string): ParsedResources {
  const fileName = 'ressources.csv';
  const resources: ResourceDef[] = [];
  const labels: Record<string, string> = {};

  for (const row of readRows(fileName, text)) {
    const label = requireCell(row, fileName, 'ressource');
    const id = lookup(RESOURCE_BY_LABEL, fileName, row, 'resource', label);
    const tierLabel = requireCell(row, fileName, 'niveau');
    const tier: ResourceTier =
      tierLabel.toLowerCase() === 'import'
        ? 'import'
        : tierLabel === '1'
          ? 1
          : tierLabel === '2'
            ? 2
            : fail(
                fileName,
                row.line,
                `unknown tier "${tierLabel}" in column "niveau"`,
              );

    const regionLabel = requireCell(row, fileName, 'region');
    let regions: ResourceDef['regions'] = [];
    let importFrom: ExpeditionDestinationId | null = null;

    if (tier === 'import') {
      if (regionLabel !== 'Partout') {
        const match = /^(.+?) \(expédition\)$/.exec(regionLabel);
        if (match === null) {
          fail(
            fileName,
            row.line,
            `import region "${regionLabel}" must look like "<destination> (expédition)"`,
          );
        }
        importFrom = lookup(
          DESTINATION_BY_LABEL,
          fileName,
          row,
          'destination',
          match[1],
        );
      }
    } else if (regionLabel !== 'Partout') {
      regions = [lookup(REGION_BY_LABEL, fileName, row, 'region', regionLabel)];
    }

    resources.push({
      id,
      tier,
      referencePrice: parseNumber(row, fileName, 'prix_ref_deben'),
      regions,
      importFrom,
      cereal: CEREAL_RESOURCES.has(id),
    });
    labels[id] = label;
  }

  return { resources, labels };
}

export interface ParsedBuildings {
  buildings: BuildingDef[];
  labels: Record<string, string>;
}

export function parseBuildings(text: string): ParsedBuildings {
  const fileName = 'batiments.csv';
  const buildings: BuildingDef[] = [];
  const labels: Record<string, string> = {};

  for (const row of readRows(fileName, text)) {
    const label = requireCell(row, fileName, 'batiment');
    const mapping = lookup(BUILDING_BY_LABEL, fileName, row, 'building', label);
    const zoneLabel = requireCell(row, fileName, 'zone');
    const zones = lookup(ZONES_BY_LABEL, fileName, row, 'zone', zoneLabel);
    const workerClass = lookup(
      WORKER_CLASS_BY_LABEL,
      fileName,
      row,
      'worker class',
      requireCell(row, fileName, 'classe'),
    );
    const rangeLabel = row.values['portee_parcelles'] ?? '';

    buildings.push({
      id: mapping.id,
      kind: mapping.kind,
      zones,
      workerClass,
      workers: parseNumber(row, fileName, 'ouvriers'),
      inputs: parseFlows(row, fileName, 'entree', 'entree_par_an'),
      outputs: parseFlows(row, fileName, 'sortie', 'sortie_par_an'),
      cost: { deben: parseNumber(row, fileName, 'cout_deben') },
      buildHours: parseNumber(row, fileName, 'duree_h'),
      service: mapping.service,
      range:
        rangeLabel === ''
          ? null
          : parseNumber(row, fileName, 'portee_parcelles'),
    });
    labels[mapping.id] = label;
  }

  return { buildings, labels };
}

function parseServices(
  row: CsvRow,
  fileName: string,
  raw: string,
): { services: Service[]; inMvp: boolean } {
  const trimmed = raw.trim();
  const inMvp = !/^hors mvp\s*:/i.test(trimmed);
  const body = trimmed.replace(/^hors mvp\s*:/i, '');
  const services: Service[] = [];

  for (const part of body.split(',')) {
    const token = part.trim().toLowerCase();
    if (token === '') {
      continue;
    }
    const counted = /^(\d+)\s+(.+)$/.exec(token);
    const count = counted === null ? 1 : Number(counted[1]);
    const name = counted === null ? token : counted[2];
    const direct = SERVICE_BY_LABEL[name] as Service | undefined;
    const singular = name.endsWith('s')
      ? (SERVICE_BY_LABEL[name.slice(0, -1)] as Service | undefined)
      : undefined;
    const service = direct ?? singular;
    if (service === undefined) {
      fail(fileName, row.line, `unknown service label "${name}"`);
    }
    for (let index = 0; index < count; index += 1) {
      services.push(service);
    }
  }

  return { services, inMvp };
}

export interface ParsedHouses {
  houses: HouseDef[];
  labels: Record<string, string>;
}

export function parseHouses(
  housesText: string,
  needsText: string,
): ParsedHouses {
  const housesFile = 'maisons.csv';
  const needsFile = 'besoins_maisons.csv';
  const needsByHouse = new Map<HouseId, HouseNeed[]>();

  for (const row of readRows(needsFile, needsText)) {
    const house = lookup(
      HOUSE_BY_LABEL,
      needsFile,
      row,
      'house',
      requireCell(row, needsFile, 'maison'),
    );
    const needs = needsByHouse.get(house) ?? [];
    needs.push({
      resource: lookup(
        RESOURCE_BY_LABEL,
        needsFile,
        row,
        'resource',
        requireCell(row, needsFile, 'ressource'),
      ),
      perInhabitantPerYear: parseNumber(row, needsFile, 'qte_par_hab_an'),
    });
    needsByHouse.set(house, needs);
  }

  const houses: HouseDef[] = [];
  const labels: Record<string, string> = {};
  const seen = new Set<HouseId>();

  for (const row of readRows(housesFile, housesText)) {
    const label = requireCell(row, housesFile, 'nom');
    const id = lookup(HOUSE_BY_LABEL, housesFile, row, 'house', label);
    seen.add(id);
    const { services, inMvp } = parseServices(
      row,
      housesFile,
      requireCell(row, housesFile, 'services_requis'),
    );
    const level = parseNumber(row, housesFile, 'niveau');

    if (level !== 1 && level !== 2 && level !== 3 && level !== 4) {
      fail(housesFile, row.line, `unsupported house level "${level}"`);
    }

    houses.push({
      id,
      level,
      inhabitants: parseNumber(row, housesFile, 'habitants'),
      workerClass: lookup(
        WORKER_CLASS_BY_LABEL,
        housesFile,
        row,
        'worker class',
        requireCell(row, housesFile, 'classe'),
      ),
      taxPerInhabitantPerYear: parseNumber(row, housesFile, 'impot_par_hab_an'),
      needs: needsByHouse.get(id) ?? [],
      services,
      inMvp,
    });
    labels[id] = label;
  }

  for (const house of needsByHouse.keys()) {
    if (!seen.has(house)) {
      throw new ImportDataError(
        `${needsFile}: needs reference house "${house}", which is not in ${housesFile}`,
      );
    }
  }

  return { houses, labels };
}

type ParameterPath =
  (typeof PARAMETER_BY_LABEL)[keyof typeof PARAMETER_BY_LABEL];

function parseZoneList(row: CsvRow, fileName: string, column: string): Zone[] {
  const raw = requireCell(row, fileName, column);
  const zones: Zone[] = [];

  for (const part of raw.split(',')) {
    const label = part.trim();
    if (label === '') {
      fail(fileName, row.line, `empty zone label in column "${column}"`);
    }
    for (const zone of lookup(ZONES_BY_LABEL, fileName, row, 'zone', label)) {
      zones.push(zone);
    }
  }

  return zones;
}

export function parseParameters(text: string): GameParameters {
  const fileName = 'parametres.csv';
  const values = new Map<ParameterPath, number>();
  let houseZones: Zone[] | null = null;

  for (const row of readRows(fileName, text)) {
    const label = requireCell(row, fileName, 'parametre');
    const path = (
      PARAMETER_BY_LABEL as Record<string, ParameterPath | undefined>
    )[label];
    if (path === undefined) {
      fail(fileName, row.line, `unknown parameter label "${label}"`);
    }
    if (path === 'houseZones') {
      houseZones = parseZoneList(row, fileName, 'valeur');
      continue;
    }
    values.set(path, parseNumber(row, fileName, 'valeur'));
  }

  const value = (path: ParameterPath): number => {
    const found = values.get(path);
    if (found === undefined) {
      throw new ImportDataError(`${fileName}: missing parameter "${path}"`);
    }
    return found;
  };

  if (houseZones === null) {
    throw new ImportDataError(`${fileName}: missing parameter "houseZones"`);
  }

  return {
    activityRate: value('activityRate'),
    floodMultiplier: {
      low: value('floodMultiplier.low'),
      good: value('floodMultiplier.good'),
      high: value('floodMultiplier.high'),
    },
    priceFloorFactor: value('priceFloorFactor'),
    priceCeilingFactor: value('priceCeilingFactor'),
    marketTax: value('marketTax'),
    tributeRate: value('tributeRate'),
    yearHours: value('yearHours'),
    defaultSpeed: value('defaultSpeed'),
    catchUpMultiplier: value('catchUpMultiplier'),
    inactivityDaysBeforeAbandon: value('inactivityDaysBeforeAbandon'),
    registrationClosesAfterYear: value('registrationClosesAfterYear'),
    baseStorage: value('baseStorage'),
    granaryCapacity: value('granaryCapacity'),
    housesPerBlock: value('housesPerBlock'),
    houseBlockCost: { deben: value('houseBlockCost.deben') },
    houseBlockBuildHours: value('houseBlockBuildHours'),
    houseZones,
    startingDeben: value('startingDeben'),
    godFavorStart: value('godFavorStart'),
    godFavorMax: value('godFavorMax'),
    godFavorDecayPerHour: value('godFavorDecayPerHour'),
    templeFavorPerHour: value('templeFavorPerHour'),
    godFavorLow: value('godFavorLow'),
    godFavorVeryLow: value('godFavorVeryLow'),
    godFavorBlessing: value('godFavorBlessing'),
    offeringIntervalHours: value('offeringIntervalHours'),
    hapyLowFloodMultiplier: value('hapyLowFloodMultiplier'),
    osirisHarvestShare: value('osirisHarvestShare'),
    bastetUpgradeHours: value('bastetUpgradeHours'),
    cardDrawIntervalHours: value('cardDrawIntervalHours'),
    cardDrawChance: value('cardDrawChance'),
    cardMaxPending: value('cardMaxPending'),
    cardGraceHours: value('cardGraceHours'),
    cardConditionalWeight: value('cardConditionalWeight'),
    cardRareWeight: value('cardRareWeight'),
    royalFavorHigh: value('royalFavorHigh'),
    royalFavorPerTribute: value('royalFavorPerTribute'),
    royalFavorPerMissingTribute: value('royalFavorPerMissingTribute'),
  };
}

function parseSlotZone(row: CsvRow, fileName: string, label: string): Zone {
  const zones = lookup(ZONES_BY_LABEL, fileName, row, 'zone', label);
  if (zones.length !== 1) {
    fail(
      fileName,
      row.line,
      `zone label "${label}" must map to exactly one zone`,
    );
  }
  return zones[0];
}

function parseStartingContent(
  row: CsvRow,
  fileName: string,
  raw: string,
): StartingContent | null {
  if (raw === '') {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(BUILDING_BY_LABEL, raw)) {
    return {
      kind: 'building',
      building: lookup(BUILDING_BY_LABEL, fileName, row, 'building', raw).id,
    };
  }
  if (Object.prototype.hasOwnProperty.call(HOUSE_BY_LABEL, raw)) {
    return {
      kind: 'houses',
      house: lookup(HOUSE_BY_LABEL, fileName, row, 'house', raw),
    };
  }
  fail(
    fileName,
    row.line,
    `unknown building or house label "${raw}" in column "contenu"`,
  );
}

export function parseStartingMap(text: string): MapSlotDef[] {
  const fileName = 'carte_depart.csv';
  const slots: MapSlotDef[] = [];

  for (const row of readRows(fileName, text)) {
    slots.push({
      slot: parseNumber(row, fileName, 'emplacement'),
      row: parseNumber(row, fileName, 'ligne'),
      col: parseNumber(row, fileName, 'colonne'),
      zone: parseSlotZone(row, fileName, requireCell(row, fileName, 'zone')),
      start: parseStartingContent(row, fileName, row.values['contenu'] ?? ''),
    });
  }

  return slots.sort((left, right) => left.slot - right.slot);
}

export function parseStartingStocks(
  text: string,
): Partial<Record<ResourceId, number>> {
  const fileName = 'stocks_depart.csv';
  const stocks: Partial<Record<ResourceId, number>> = {};
  const seen = new Set<ResourceId>();

  for (const row of readRows(fileName, text)) {
    const resource = lookup(
      RESOURCE_BY_LABEL,
      fileName,
      row,
      'resource',
      requireCell(row, fileName, 'ressource'),
    );
    if (seen.has(resource)) {
      fail(fileName, row.line, `resource "${resource}" appears more than once`);
    }
    seen.add(resource);
    stocks[resource] = parseNumber(row, fileName, 'quantite');
  }

  return stocks;
}

export interface ParsedExpeditions {
  expeditions: ExpeditionRouteDef[];
  routeLabels: Record<string, string>;
  destinationLabels: Record<string, string>;
}

export function parseExpeditions(text: string): ParsedExpeditions {
  const fileName = 'expeditions.csv';
  const expeditions: ExpeditionRouteDef[] = [];
  const routeLabels: Record<string, string> = {};
  const destinationLabels: Record<string, string> = {};

  for (const row of readRows(fileName, text)) {
    const destinationLabel = requireCell(row, fileName, 'destination');
    const destination = lookup(
      DESTINATION_BY_LABEL,
      fileName,
      row,
      'destination',
      destinationLabel,
    );
    const routeLabel = requireCell(row, fileName, 'route');
    const safe = /sûr/i.test(routeLabel);
    const id = `${destination}_${safe ? 'safe' : 'fast'}`;

    expeditions.push({
      id,
      destination,
      safe,
      durationHours: parseNumber(row, fileName, 'duree_h'),
      costDeben: parseNumber(row, fileName, 'cout_deben'),
      resource: lookup(
        RESOURCE_BY_LABEL,
        fileName,
        row,
        'resource',
        requireCell(row, fileName, 'rapporte'),
      ),
      quantity: parseNumber(row, fileName, 'quantite'),
      lossRisk: parseNumber(row, fileName, 'risque_perte'),
    });
    routeLabels[id] = routeLabel;
    destinationLabels[destination] = destinationLabel;
  }

  return { expeditions, routeLabels, destinationLabels };
}

export function parseGods(text: string): GodDef[] {
  const fileName = 'dieux.csv';
  const byGod = new Map<God, GodDef>();

  for (const row of readRows(fileName, text)) {
    const id = lookup(
      GOD_BY_LABEL,
      fileName,
      row,
      'god',
      requireCell(row, fileName, 'dieu'),
    );
    if (byGod.has(id)) {
      fail(fileName, row.line, `god "${id}" appears more than once`);
    }
    const quantity = parseNumber(row, fileName, 'offrande_quantite');
    const favor = parseNumber(row, fileName, 'faveur_offrande');
    if (quantity <= 0) {
      fail(fileName, row.line, `offering quantity must be positive`);
    }
    if (favor <= 0) {
      fail(fileName, row.line, `offering favour must be positive`);
    }
    byGod.set(id, {
      id,
      offering: {
        resource: lookup(
          RESOURCE_BY_LABEL,
          fileName,
          row,
          'resource',
          requireCell(row, fileName, 'offrande_ressource'),
        ),
        quantity,
      },
      favorPerOffering: favor,
    });
  }

  return GODS.map((god) => {
    const found = byGod.get(god);
    if (found === undefined) {
      throw new ImportDataError(`${fileName}: missing god "${god}"`);
    }
    return found;
  });
}

/** Amounts and durations as they appear in the spreadsheet ("+30", "1,5"). */
const SIGNED_NUMBER = String.raw`[+-]?\d+(?:[.,]\d+)?`;
const UNSIGNED_NUMBER = String.raw`\d+(?:[.,]\d+)?`;

function textNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

/** Case-insensitive match of one card text pattern. */
function match(raw: string, pattern: string): RegExpExecArray | null {
  return new RegExp(pattern, 'i').exec(raw);
}

function unknownEffect(fileName: string, line: number, raw: string): never {
  fail(fileName, line, `unknown card effect "${raw}"`);
}

function requireResourceLabel(
  label: string,
  fileName: string,
  line: number,
): ResourceId {
  const resource = findLabel(RESOURCE_BY_LABEL, label);
  if (resource === undefined) {
    fail(fileName, line, `unknown resource label "${label}"`);
  }
  return resource;
}

/** Duration of an effect, used by the ", puis" production chain. */
function effectHours(effect: CardEffect): number | 'year' | null {
  switch (effect.kind) {
    case 'workforce':
    case 'idle':
    case 'consumption':
    case 'houseUpgrade':
    case 'floodForecast':
      return effect.hours;
    case 'production':
      return effect.hours;
    default:
      return null;
  }
}

function parseEffectAtom(
  raw: string,
  fileName: string,
  line: number,
): CardEffect | null {
  const text = raw.trim();
  if (/^(rien|récolte protégée)$/i.test(text)) {
    return null;
  }

  const chance = match(text, String.raw`^(${UNSIGNED_NUMBER})\s*%\s*:\s*(.+)$`);
  if (chance !== null) {
    const effect = parseEffectAtom(chance[2], fileName, line);
    if (effect === null) {
      unknownEffect(fileName, line, text);
    }
    return {
      kind: 'chance',
      probability: textNumber(chance[1]) / 100,
      effect,
    };
  }

  const everyWorker = match(
    text,
    String.raw`^production\s+(${SIGNED_NUMBER})\s*%\s*(?:pendant\s+)?(${UNSIGNED_NUMBER})\s*h$`,
  );
  if (everyWorker !== null) {
    return {
      kind: 'workforce',
      workerClass: 'all',
      change: { percent: textNumber(everyWorker[1]) },
      hours: textNumber(everyWorker[2]),
    };
  }

  const fieldWorkers = match(
    text,
    String.raw`^ouvriers des champs\s+(${SIGNED_NUMBER})\s*%\s*(?:pendant\s+)?(${UNSIGNED_NUMBER})\s*h$`,
  );
  if (fieldWorkers !== null) {
    return {
      kind: 'idle',
      target: { kind: 'fields' },
      percent: textNumber(fieldWorkers[1]),
      hours: textNumber(fieldWorkers[2]),
    };
  }

  const consumption = match(
    text,
    String.raw`^conso de (.+?)\s+(${SIGNED_NUMBER})\s*%\s*(?:pendant\s+)?(${UNSIGNED_NUMBER})\s*h$`,
  );
  if (consumption !== null) {
    return {
      kind: 'consumption',
      resource: requireResourceLabel(consumption[1], fileName, line),
      percent: textNumber(consumption[2]),
      hours: textNumber(consumption[3]),
    };
  }

  const houseUpgrade = match(
    text,
    String.raw`^(?:(?:une\s+)?maisons?\s*:\s*)?montée de niveau\s+(bloquée|accélérée)\s+(${UNSIGNED_NUMBER})\s*h$`,
  );
  if (houseUpgrade !== null) {
    return {
      kind: 'houseUpgrade',
      mode: /^bloqu/i.test(houseUpgrade[1]) ? 'blocked' : 'fast',
      hours: textNumber(houseUpgrade[2]),
    };
  }

  const forecast = match(
    text,
    String.raw`^prochaine crue révélée\s+(${UNSIGNED_NUMBER})\s*h en avance$`,
  );
  if (forecast !== null) {
    return { kind: 'floodForecast', hours: textNumber(forecast[1]) };
  }

  const zoneIdle = match(
    text,
    String.raw`^parcelles de (.+?)\s+inactives?\s+(${UNSIGNED_NUMBER})\s*h$`,
  );
  if (zoneIdle !== null) {
    const zones = findLabel(ZONES_BY_LABEL, zoneIdle[1]);
    if (zones === undefined || zones.length !== 1) {
      unknownEffect(fileName, line, text);
    }
    return {
      kind: 'idle',
      target: { kind: 'zone', zone: zones[0] },
      percent: -100,
      hours: textNumber(zoneIdle[2]),
    };
  }

  const buildingIdle = match(
    text,
    String.raw`^(.+?)\s+(?:inactif|inactive|inaccessible)\s+(${UNSIGNED_NUMBER})\s*h$`,
  );
  if (buildingIdle !== null) {
    const building = findLabel(CARD_BUILDING_BY_LABEL, buildingIdle[1]);
    if (building === undefined) {
      unknownEffect(fileName, line, text);
    }
    return {
      kind: 'idle',
      target: { kind: 'building', building },
      percent: -100,
      hours: textNumber(buildingIdle[2]),
    };
  }

  const harvest = match(text, String.raw`^récolte\s+(${SIGNED_NUMBER})\s*%$`);
  if (harvest !== null) {
    return { kind: 'harvest', percent: textNumber(harvest[1]) };
  }

  const tribute = match(text, String.raw`^tribut\s+(${SIGNED_NUMBER})\s*%$`);
  if (tribute !== null) {
    return { kind: 'tribute', percent: textNumber(tribute[1]) };
  }

  const deben = match(text, String.raw`^deben\s+(${SIGNED_NUMBER})$`);
  if (deben !== null) {
    return { kind: 'deben', amount: textNumber(deben[1]) };
  }

  const royalFavor = match(text, String.raw`^faveur\s+(${SIGNED_NUMBER})$`);
  if (royalFavor !== null) {
    return { kind: 'royalFavor', amount: textNumber(royalFavor[1]) };
  }

  const allGods = match(
    text,
    String.raw`^tous les dieux\s+(${SIGNED_NUMBER})$`,
  );
  if (allGods !== null) {
    return { kind: 'godFavor', god: 'all', amount: textNumber(allGods[1]) };
  }

  const idleWorkers = match(
    text,
    String.raw`^(.+?)\s+inactifs?\s+(${UNSIGNED_NUMBER})\s*h$`,
  );
  if (idleWorkers !== null) {
    const workerClass = findLabel(CARD_WORKER_CLASS_BY_LABEL, idleWorkers[1]);
    if (workerClass === undefined) {
      unknownEffect(fileName, line, text);
    }
    return {
      kind: 'workforce',
      workerClass,
      change: { percent: -100 },
      hours: textNumber(idleWorkers[2]),
    };
  }

  const withDuration = match(
    text,
    String.raw`^(.+?)\s+(${SIGNED_NUMBER})\s*%\s*(?:pendant\s+)?(${UNSIGNED_NUMBER})\s*h$`,
  );
  if (withDuration !== null) {
    const workerClass = findLabel(CARD_WORKER_CLASS_BY_LABEL, withDuration[1]);
    if (workerClass !== undefined) {
      return {
        kind: 'workforce',
        workerClass,
        change: { percent: textNumber(withDuration[2]) },
        hours: textNumber(withDuration[3]),
      };
    }
    const resource = findLabel(RESOURCE_BY_LABEL, withDuration[1]);
    if (resource !== undefined) {
      return {
        kind: 'production',
        resource,
        percent: textNumber(withDuration[2]),
        hours: textNumber(withDuration[3]),
        startsAfter: 0,
      };
    }
    unknownEffect(fileName, line, text);
  }

  const workerCount = match(
    text,
    String.raw`^(.+?)\s+(${SIGNED_NUMBER})\s+pendant\s+(${UNSIGNED_NUMBER})\s*h$`,
  );
  if (workerCount !== null) {
    const workerClass = findLabel(CARD_WORKER_CLASS_BY_LABEL, workerCount[1]);
    if (workerClass !== undefined) {
      return {
        kind: 'workforce',
        workerClass,
        change: { count: textNumber(workerCount[2]) },
        hours: textNumber(workerCount[3]),
      };
    }
    unknownEffect(fileName, line, text);
  }

  const productionYear = match(
    text,
    String.raw`^(.+?)\s+(${SIGNED_NUMBER})\s*%\s+jusqu'à la fin de l'année$`,
  );
  if (productionYear !== null) {
    return {
      kind: 'production',
      resource: requireResourceLabel(productionYear[1], fileName, line),
      percent: textNumber(productionYear[2]),
      hours: 'year',
      startsAfter: 0,
    };
  }

  const percentOnly = match(text, String.raw`^(.+?)\s+(${SIGNED_NUMBER})\s*%$`);
  if (percentOnly !== null) {
    return {
      kind: 'resourceShare',
      resource: requireResourceLabel(percentOnly[1], fileName, line),
      percent: textNumber(percentOnly[2]),
    };
  }

  const amountOnly = match(text, String.raw`^(.+?)\s+(${SIGNED_NUMBER})$`);
  if (amountOnly !== null) {
    const label = amountOnly[1];
    const amount = textNumber(amountOnly[2]);
    const resource = findLabel(RESOURCE_BY_LABEL, label);
    if (resource !== undefined) {
      return { kind: 'resource', resource, amount };
    }
    const god = findLabel(GOD_BY_LABEL, label);
    if (god !== undefined) {
      return { kind: 'godFavor', god, amount };
    }
    const workerClass = findLabel(CARD_WORKER_CLASS_BY_LABEL, label);
    if (workerClass !== undefined) {
      return { kind: 'population', workerClass, amount };
    }
  }

  return unknownEffect(fileName, line, text);
}

function parseEffectAtoms(
  raw: string,
  fileName: string,
  line: number,
): CardEffect[] {
  const thenMatch = match(raw, String.raw`^(.+?)\s*,\s*puis\s+(.+)$`);
  if (thenMatch === null) {
    const effect = parseEffectAtom(raw, fileName, line);
    return effect === null ? [] : [effect];
  }

  const first = parseEffectAtom(thenMatch[1], fileName, line);
  if (first === null) {
    fail(fileName, line, `"${raw}" has no effect before ", puis"`);
  }
  const hours = effectHours(first);
  if (hours === null || hours === 'year') {
    fail(fileName, line, `"${raw}" must chain after an effect with a duration`);
  }
  const second = parseEffectAtom(thenMatch[2], fileName, line);
  if (second === null || second.kind !== 'production') {
    fail(
      fileName,
      line,
      `"${raw}" must end with a production effect after ", puis"`,
    );
  }
  return [first, { ...second, startsAfter: hours }];
}

export function parseCardEffects(
  text: string,
  fileName: string,
  line: number,
): CardEffect[] {
  const trimmed = text.trim();
  if (trimmed === '' || /^rien$/i.test(trimmed)) {
    return [];
  }
  const effects: CardEffect[] = [];
  for (const chunk of trimmed.split(';')) {
    const atom = chunk.trim();
    if (atom === '') {
      continue;
    }
    for (const effect of parseEffectAtoms(atom, fileName, line)) {
      effects.push(effect);
    }
  }
  return effects;
}

const TRIGGER_LEVEL_BY_LABEL = {
  basse: 'low',
  'très basse': 'veryLow',
} as const;

const FLOOD_LEVEL_BY_LABEL = {
  basse: 'low',
  bonne: 'good',
  haute: 'high',
} as const;

export function parseCardTrigger(
  text: string,
  fileName: string,
  line: number,
): CardTrigger {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  if (lower === 'aléatoire' || lower === 'une fois par année') {
    return { kind: 'random' };
  }
  if (lower === 'rare') {
    return { kind: 'rare' };
  }
  if (lower.startsWith('tutoriel')) {
    return { kind: 'tutorial' };
  }
  if (lower === 'faveur royale élevée') {
    return { kind: 'royalFavorHigh' };
  }
  if (lower === "début d'akhet") {
    return { kind: 'phaseStart' };
  }
  if (lower === 'avant le tribut') {
    return { kind: 'beforeTribute' };
  }

  const stock = match(
    raw,
    String.raw`^stock de (.+?)\s*>\s*(${UNSIGNED_NUMBER})$`,
  );
  if (stock !== null) {
    return {
      kind: 'stockAbove',
      resource: requireResourceLabel(stock[1], fileName, line),
      quantity: textNumber(stock[2]),
    };
  }

  const favor = match(raw, String.raw`^faveur de (.+?)\s+(très basse|basse)$`);
  if (favor !== null) {
    const god = findLabel(GOD_BY_LABEL, favor[1]);
    if (god === undefined) {
      fail(fileName, line, `unknown god label "${favor[1]}"`);
    }
    return {
      kind: 'godFavorBelow',
      god,
      level:
        TRIGGER_LEVEL_BY_LABEL[
          favor[2].toLowerCase() as keyof typeof TRIGGER_LEVEL_BY_LABEL
        ],
    };
  }

  const flood = match(raw, String.raw`^crue (basse|bonne|haute)$`);
  if (flood !== null) {
    return {
      kind: 'flood',
      level:
        FLOOD_LEVEL_BY_LABEL[
          flood[1].toLowerCase() as keyof typeof FLOOD_LEVEL_BY_LABEL
        ],
    };
  }

  const built = match(raw, String.raw`^(.+?)\s+construit(?:e)?$`);
  if (built !== null) {
    const building = findLabel(CARD_BUILDING_BY_LABEL, built[1]);
    if (building === undefined) {
      fail(fileName, line, `unknown building label "${built[1]}"`);
    }
    return { kind: 'built', building };
  }

  const houses = match(
    raw,
    String.raw`^(${UNSIGNED_NUMBER})\s+maisons ou plus$`,
  );
  if (houses !== null) {
    return { kind: 'housesAtLeast', count: textNumber(houses[1]) };
  }

  const busy = match(
    raw,
    String.raw`^(.+?)\s+occupés à 100\s*%\s+depuis\s+(${UNSIGNED_NUMBER})\s*h$`,
  );
  if (busy !== null) {
    const workerClass = findLabel(CARD_WORKER_CLASS_BY_LABEL, busy[1]);
    if (workerClass === undefined) {
      fail(fileName, line, `unknown worker class label "${busy[1]}"`);
    }
    return {
      kind: 'busyWorkers',
      workerClass,
      hours: textNumber(busy[2]),
    };
  }

  const price = match(
    raw,
    String.raw`^prix du (.+?)\s*>\s*prix réf\.\s*×\s*(${UNSIGNED_NUMBER})$`,
  );
  if (price !== null) {
    return {
      kind: 'priceAbove',
      resource: requireResourceLabel(price[1], fileName, line),
      factor: textNumber(price[2]),
    };
  }

  return fail(fileName, line, `unknown card trigger "${raw}"`);
}

export interface CardLabels {
  title: string;
  text: string;
  choices: Record<string, { label: string; effect: string }>;
}

export interface ParsedCards {
  cards: EventCardDef[];
  labels: Record<string, CardLabels>;
}

const CARD_CHOICE_COLUMNS: readonly {
  key: CardChoiceKey;
  label: string;
  effect: string;
}[] = [
  { key: 'a', label: 'choix_a', effect: 'effet_a' },
  { key: 'b', label: 'choix_b', effect: 'effet_b' },
  { key: 'c', label: 'choix_c', effect: 'effet_c' },
];

function parseChoiceKey(
  fileName: string,
  row: CsvRow,
  raw: string,
): CardChoiceKey {
  const key = raw.toLowerCase();
  if (key !== 'a' && key !== 'b' && key !== 'c') {
    fail(fileName, row.line, `unknown default choice "${raw}"`);
  }
  return key;
}

export function parseCards(text: string): ParsedCards {
  const fileName = 'cartes.csv';
  const cards: EventCardDef[] = [];
  const labels: Record<string, CardLabels> = {};

  for (const row of readRows(fileName, text)) {
    const id = requireCell(row, fileName, 'id');
    const phaseLabel = row.values['phase'] ?? '';
    if (phaseLabel === '') {
      fail(
        fileName,
        row.line,
        'column "phase" is required because cards have no null phase',
      );
    }
    const phase: CardPhase = lookup(
      CARD_PHASE_BY_LABEL,
      fileName,
      row,
      'phase',
      phaseLabel,
    );
    const godLabel = row.values['dieu'] ?? '';
    const god: God | null =
      godLabel === ''
        ? null
        : lookup(GOD_BY_LABEL, fileName, row, 'god', godLabel);

    const choices: EventCardDef['choices'] = [];
    const choiceLabels: CardLabels['choices'] = {};
    for (const column of CARD_CHOICE_COLUMNS) {
      const label = row.values[column.label] ?? '';
      if (label === '') {
        continue;
      }
      const effect = row.values[column.effect] ?? '';
      choices.push({
        key: column.key,
        effectRaw: effect,
        effects: parseCardEffects(effect, fileName, row.line),
      });
      choiceLabels[column.key] = { label, effect };
    }

    const defaultChoice = parseChoiceKey(
      fileName,
      row,
      requireCell(row, fileName, 'defaut'),
    );
    const title = requireCell(row, fileName, 'titre');
    const cardText = requireCell(row, fileName, 'texte');
    const triggerRaw = requireCell(row, fileName, 'declencheur');

    cards.push({
      id,
      triggerRaw,
      trigger: parseCardTrigger(triggerRaw, fileName, row.line),
      phase,
      god,
      choices,
      defaultChoice,
    });
    labels[id] = { title, text: cardText, choices: choiceLabels };
  }

  return { cards, labels };
}
