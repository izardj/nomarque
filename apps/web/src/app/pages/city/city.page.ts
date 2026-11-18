import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '../../core/clock';
import {
  buildingDef,
  buildingLabel,
  houseDef,
  housesLabel,
  plural,
} from '../../core/labels';
import { NomeStore } from '../../core/nome.store';
import { FR_LABELS, ZONES } from '@nomarque/data';
import { fr } from '../../i18n/fr';
import {
  type BuildChoice,
  type CropOption,
  buildChoices,
  buildTiles,
  cropOptions,
  buildingSummary,
  isSite,
  siteRemaining,
} from './city-view';

/** What the detail panel tells about the selected parcel. */
interface Detail {
  slot: number;
  mode: 'empty' | 'building' | 'houses' | 'site';
  title: string;
  /** Lines of text under the title. */
  lines: string[];
  /** Workers line of a finished building. */
  workers: string | null;
  choices: BuildChoice[];
  /** Crops a finished field may switch to; empty for any other parcel. */
  crops: CropOption[];
}

@Component({
  selector: 'app-city-page',
  imports: [RouterLink],
  templateUrl: './city.page.html',
  styleUrl: './city.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CityPage {
  private readonly store = inject(NomeStore);
  private readonly clock = inject(Clock);

  protected readonly t = fr.city;
  protected readonly zones = ZONES.map((zone) => ({
    zone,
    label: fr.zones[zone],
  }));
  protected readonly worldId = this.store.worldId;
  protected readonly busy = this.store.busy;
  protected readonly reignOver = this.store.reignOver;
  protected readonly selectedSlot = signal<number | null>(null);
  protected readonly chosenKey = signal<string | null>(null);

  protected readonly nome = this.store.nome;
  protected readonly tiles = computed(() => {
    const nome = this.nome();
    return nome === null
      ? []
      : buildTiles(nome, this.selectedSlot(), this.clock.now());
  });
  protected readonly columns = computed(
    () => 1 + Math.max(0, ...(this.nome()?.parcels.map((p) => p.col) ?? [])),
  );
  protected readonly built = computed(
    () => this.tiles().filter((tile) => tile.kind !== 'empty').length,
  );
  protected readonly rangeOf = computed(() => {
    const selected = this.tiles().find((tile) => tile.selected);
    const parcel = selected?.parcel;
    if (!parcel || parcel.building === null || isSite(parcel)) {
      return null;
    }
    const def = buildingDef(parcel.building);
    return def.range === null ? null : buildingLabel(def.id);
  });
  protected readonly detail = computed<Detail | null>(() => {
    const nome = this.nome();
    const parcel = nome?.parcels.find(
      (candidate) => candidate.slot === this.selectedSlot(),
    );
    if (!nome || !parcel) {
      return null;
    }
    const nowMs = this.clock.now();
    const remaining = siteRemaining(parcel, nowMs);
    const siteLine =
      remaining === null ? this.t.siteDetailSoon : this.t.siteDetail(remaining);

    if (isSite(parcel)) {
      const title =
        parcel.building !== null
          ? buildingLabel(parcel.building)
          : this.t.houseBlock;
      return {
        slot: parcel.slot,
        mode: 'site',
        title,
        lines: [siteLine],
        workers: null,
        choices: [],
        crops: [],
      };
    }
    if (parcel.building !== null) {
      const def = buildingDef(parcel.building);
      const lines: string[] = [];
      if (def.service !== null && def.range !== null) {
        lines.push(this.t.service(fr.services[def.service], def.range));
      } else if (def.kind === 'storage') {
        lines.push(this.t.storage);
      } else if (def.kind === 'port') {
        lines.push(this.t.port);
      } else if (def.outputs.length > 0) {
        lines.push(this.t.produces(buildingSummary(def)));
      }
      const workerClass = fr.workerClasses[def.workerClass];
      return {
        slot: parcel.slot,
        mode: 'building',
        title: buildingLabel(def.id),
        lines,
        workers: this.t.workers(
          parcel.workers,
          def.workers,
          plural(workerClass.one, def.workers),
        ),
        choices: [],
        crops: cropOptions(parcel),
      };
    }
    if (parcel.houses !== null) {
      const { level, count } = parcel.houses;
      return {
        slot: parcel.slot,
        mode: 'houses',
        title: `${housesLabel(level, count)} ×${count}`,
        lines: [this.t.houseLevel(level, FR_LABELS.houses[houseDef(level).id])],
        workers: null,
        choices: [],
        crops: [],
      };
    }
    return {
      slot: parcel.slot,
      mode: 'empty',
      title: this.t.emptyTitle,
      lines: [this.t.zone(fr.zones[parcel.zone])],
      workers: null,
      choices: buildChoices(parcel.zone, nome.deben),
      crops: [],
    };
  });
  protected readonly cropsLocked = computed(
    () => this.nome()?.nile.cropsLocked ?? true,
  );
  protected readonly chosen = computed(
    () =>
      this.detail()?.choices.find(
        (choice) => choice.key === this.chosenKey(),
      ) ?? null,
  );

  protected select(slot: number): void {
    this.chosenKey.set(null);
    this.selectedSlot.update((current) => (current === slot ? null : slot));
  }

  protected close(): void {
    this.selectedSlot.set(null);
    this.chosenKey.set(null);
  }

  protected choose(choice: BuildChoice): void {
    this.chosenKey.update((current) =>
      current === choice.key ? null : choice.key,
    );
  }

  protected async changeCrop(crop: CropOption): Promise<void> {
    const slot = this.selectedSlot();
    if (slot !== null && !crop.current) {
      await this.store.chooseCrop(slot, crop.building);
    }
  }

  protected async confirm(): Promise<void> {
    const slot = this.selectedSlot();
    const choice = this.chosen();
    if (slot === null || choice === null) {
      return;
    }
    if (await this.store.build(slot, choice.request)) {
      this.close();
    }
  }
}
