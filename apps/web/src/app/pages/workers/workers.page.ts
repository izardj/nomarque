import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NomeStore } from '../../core/nome.store';
import { fr } from '../../i18n/fr';
import { classCards, workerRows, type WorkerRow } from './workers-view';

@Component({
  selector: 'app-workers-page',
  imports: [RouterLink],
  templateUrl: './workers.page.html',
  styleUrl: './workers.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkersPage {
  private readonly store = inject(NomeStore);

  protected readonly t = fr.workers;
  protected readonly worldId = this.store.worldId;
  protected readonly reignOver = this.store.reignOver;
  protected readonly loaded = computed(() => this.store.nome() !== null);
  protected readonly cards = computed(() => {
    const nome = this.store.nome();
    return nome === null ? [] : classCards(nome);
  });
  protected readonly rows = computed(() => {
    const nome = this.store.nome();
    return nome === null ? [] : workerRows(nome, this.store.workerDrafts());
  });

  protected step(row: WorkerRow, delta: 1 | -1): void {
    this.store.setWorkers(row.slot, row.workers + delta);
  }
}
