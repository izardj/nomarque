import type { NomeDto, ParcelDto } from '@nomarque/contracts';
import { WORKER_CLASSES, type WorkerClass } from '@nomarque/data';
import {
  amountEntries,
  buildingDef,
  buildingLabel,
  formatNumber,
  resourceLabel,
} from '../../core/labels';
import { fr } from '../../i18n/fr';

export interface ClassCard {
  workerClass: WorkerClass;
  title: string;
  count: string;
  /** Free workers, or a shortage. */
  status: string;
  short: boolean;
  hasFree: boolean;
}

export interface WorkerRow {
  slot: number;
  name: string;
  meta: string;
  workers: number;
  required: number;
  /** The server forecast: harvest for fields, yearly output otherwise. */
  forecast: string | null;
  /** Shown when the building is not fully staffed. */
  understaffed: string | null;
  removeLabel: string;
  addLabel: string;
  /** A change is waiting to be sent. */
  pending: boolean;
}

export function classCards(nome: NomeDto): ClassCard[] {
  return WORKER_CLASSES.flatMap((workerClass) => {
    const { available, assigned } = nome.workforce[workerClass];
    if (available === 0 && assigned === 0) {
      return [];
    }
    const free = available - assigned;
    return [
      {
        workerClass,
        title: fr.workerClasses[workerClass].title,
        count: fr.workers.classCount(assigned, available),
        status: free >= 0 ? fr.workers.free(free) : fr.workers.short(-free),
        short: free < 0,
        hasFree: free > 0,
      },
    ];
  });
}

function forecast(parcel: ParcelDto): string | null {
  const harvest = amountEntries(parcel.harvest);
  if (harvest.length > 0) {
    return harvest
      .map(({ resource, quantity }) =>
        fr.workers.harvest(formatNumber(quantity), resourceLabel(resource)),
      )
      .join(' · ');
  }
  const yearly = amountEntries(parcel.perYear);
  if (yearly.length > 0) {
    return yearly
      .map(({ resource, quantity }) =>
        fr.workers.perYear(formatNumber(quantity), resourceLabel(resource)),
      )
      .join(' · ');
  }
  return null;
}

/** One row per finished building, with the count the player is tapping. */
export function workerRows(
  nome: NomeDto,
  drafts: Readonly<Record<number, number>>,
): WorkerRow[] {
  const rows: WorkerRow[] = [];
  for (const parcel of nome.parcels) {
    if (parcel.building === null || parcel.buildEndsAt !== null) {
      continue;
    }
    const def = buildingDef(parcel.building);
    const classNames = fr.workerClasses[def.workerClass];
    const draft = drafts[parcel.slot];
    const workers = draft ?? parcel.workers;
    const place = fr.workers.place(
      buildingLabel(def.id),
      parcel.row + 1,
      parcel.col + 1,
    );
    const occupancy = parcel.occupancy;
    rows.push({
      slot: parcel.slot,
      name: buildingLabel(def.id),
      meta: fr.workers.meta(
        classNames.title,
        def.workers,
        parcel.row + 1,
        parcel.col + 1,
      ),
      workers,
      required: def.workers,
      forecast: forecast(parcel),
      understaffed:
        occupancy !== null && occupancy < 1
          ? fr.workers.underStaffed(
              workers,
              def.workers,
              Math.round((1 - occupancy) * 100),
            )
          : null,
      removeLabel: fr.workers.remove(classNames.one, place),
      addLabel: fr.workers.add(classNames.one, place),
      pending: draft !== undefined,
    });
  }
  return rows;
}
