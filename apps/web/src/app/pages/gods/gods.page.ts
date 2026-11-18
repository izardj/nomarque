import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { GAME_DATA, type God } from '@nomarque/data';
import { Clock } from '../../core/clock';
import { NomeStore } from '../../core/nome.store';
import { fr } from '../../i18n/fr';
import { godViews, modifierViews, nileView } from './gods-view';

/** The Nile, the five gods and the lasting effects of the cards. */
@Component({
  selector: 'app-gods-page',
  templateUrl: './gods.page.html',
  styleUrl: './gods.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GodsPage {
  private readonly store = inject(NomeStore);
  private readonly clock = inject(Clock);

  protected readonly t = fr.gods;
  protected readonly nile = fr.nile;
  protected readonly busy = this.store.busy;
  protected readonly thresholds = fr.gods.thresholds(
    GAME_DATA.parameters.godFavorLow,
    GAME_DATA.parameters.godFavorBlessing,
  );
  protected readonly loaded = computed(() => this.store.nome() !== null);
  protected readonly nileInfo = computed(() => {
    const nome = this.store.nome();
    return nome === null ? null : nileView(nome.nile, this.clock.now());
  });
  protected readonly gods = computed(() => {
    const nome = this.store.nome();
    return nome === null ? [] : godViews(nome, this.clock.now());
  });
  protected readonly modifiers = computed(() => {
    const nome = this.store.nome();
    return nome === null ? [] : modifierViews(nome, this.clock.now());
  });

  protected offer(god: God): void {
    void this.store.makeOffering(god);
  }
}
