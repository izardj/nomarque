import type { BuildRequest, NomeDto, ParcelDto } from '@nomarque/contracts';
import { GAME_DATA, type BuildingDef, type Zone } from '@nomarque/data';
import {
  buildingDef,
  buildingLabel,
  formatRemaining,
  housesLabel,
  parcelName,
  resourceLabel,
} from '../../core/labels';
import { fr } from '../../i18n/fr';

export type TileKind = 'empty' | 'building' | 'houses' | 'site';

export interface Tile {
  parcel: ParcelDto;
  kind: TileKind;
  title: string;
  sub: string;
  /** Spoken description of the tile. */
  label: string;
  selected: boolean;
  /** Covered by the service of the selected building. */
  inRange: boolean;
}

export interface BuildChoice {
  key: string;
  request: BuildRequest;
  name: string;
  detail: string | null;
  cost: string;
  affordable: boolean;
}

/** Remaining time of a construction, or null when it is over (or unknown). */
export function siteRemaining(parcel: ParcelDto, nowMs: number): string | null {
  if (parcel.buildEndsAtIso === null) {
    return null;
  }
  return formatRemaining(Date.parse(parcel.buildEndsAtIso), nowMs);
}

export function isSite(parcel: ParcelDto): boolean {
  return parcel.buildEndsAt !== null;
}

export function siteText(parcel: ParcelDto, nowMs: number): string {
  const remaining = siteRemaining(parcel, nowMs);
  return remaining === null ? fr.city.siteSoon : fr.city.site(remaining);
}

/** What a finished building does, in a few words, for its tile. */
export function buildingSummary(def: BuildingDef): string {
  if (def.outputs.length > 0) {
    return def.outputs.map((flow) => resourceLabel(flow.resource)).join(', ');
  }
  if (def.service !== null) {
    return fr.services[def.service];
  }
  return fr.city.kinds[def.kind];
}

/** Parcels within `range` orthogonal steps of `center`, diagonals excluded. */
export function slotsInRange(
  parcels: readonly ParcelDto[],
  center: ParcelDto,
  range: number,
): ReadonlySet<number> {
  const slots = new Set<number>();
  for (const parcel of parcels) {
    const distance =
      Math.abs(parcel.row - center.row) + Math.abs(parcel.col - center.col);
    if (parcel.slot !== center.slot && distance <= range) {
      slots.add(parcel.slot);
    }
  }
  return slots;
}

/** Slots covered by the selected parcel, empty unless it is a finished service. */
export function selectedRange(
  parcels: readonly ParcelDto[],
  selected: ParcelDto | null,
): ReadonlySet<number> {
  if (selected === null || selected.building === null || isSite(selected)) {
    return new Set();
  }
  const { range } = buildingDef(selected.building);
  return range === null ? new Set() : slotsInRange(parcels, selected, range);
}

function tileKind(parcel: ParcelDto): TileKind {
  if (isSite(parcel)) {
    return 'site';
  }
  if (parcel.building !== null) {
    return 'building';
  }
  return parcel.houses !== null ? 'houses' : 'empty';
}

export function buildTiles(
  nome: NomeDto,
  selectedSlot: number | null,
  nowMs: number,
): Tile[] {
  const selected =
    nome.parcels.find((parcel) => parcel.slot === selectedSlot) ?? null;
  const covered = selectedRange(nome.parcels, selected);

  return nome.parcels.map((parcel) => {
    const kind = tileKind(parcel);
    const name = parcelName(parcel) ?? fr.city.build;
    let title = name;
    let sub = '';
    if (kind === 'site') {
      sub = siteText(parcel, nowMs);
    } else if (kind === 'building' && parcel.building !== null) {
      sub = buildingSummary(buildingDef(parcel.building));
    } else if (kind === 'houses' && parcel.houses !== null) {
      title = housesLabel(parcel.houses.level, parcel.houses.count);
      sub = fr.city.houses(parcel.houses.count, parcel.houses.level);
    }
    const inRange = covered.has(parcel.slot);
    const label =
      kind === 'empty'
        ? fr.city.emptyTileLabel(fr.zones[parcel.zone])
        : `${title}, ${sub}${inRange ? `, ${fr.city.inRange}` : ''}`;
    return {
      parcel,
      kind,
      title,
      sub,
      label,
      selected: parcel.slot === selectedSlot,
      inRange,
    };
  });
}

function choiceCost(deben: number, hours: number, available: number) {
  return { cost: fr.city.cost(deben, hours), affordable: available >= deben };
}

/** Everything that may be built on a parcel of this zone, houses included. */
export function buildChoices(zone: Zone, deben: number): BuildChoice[] {
  const { parameters } = GAME_DATA;
  const choices: BuildChoice[] = [];
  if (parameters.houseZones.includes(zone)) {
    choices.push({
      key: 'houses',
      request: { kind: 'houses' },
      name: fr.city.houseBlock,
      detail: fr.city.houseBlockDetail(
        parameters.housesPerBlock,
        housesLabel(1, parameters.housesPerBlock).toLowerCase(),
      ),
      ...choiceCost(
        parameters.houseBlockCost.deben,
        parameters.houseBlockBuildHours,
        deben,
      ),
    });
  }
  for (const def of GAME_DATA.buildings) {
    if (def.zones.includes(zone)) {
      choices.push({
        key: def.id,
        request: { kind: 'building', building: def.id },
        name: buildingLabel(def.id),
        detail: buildingSummary(def),
        ...choiceCost(def.cost.deben, def.buildHours, deben),
      });
    }
  }
  return choices;
}
