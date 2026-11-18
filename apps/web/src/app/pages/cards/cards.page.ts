import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '../../core/clock';
import { NomeStore } from '../../core/nome.store';
import { fr } from '../../i18n/fr';
import { type CardChoiceView, buildCardView } from './cards-view';

/** The event cards waiting for a decision, one at a time. */
@Component({
  selector: 'app-cards-page',
  imports: [RouterLink],
  templateUrl: './cards.page.html',
  styleUrl: './cards.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardsPage {
  private readonly store = inject(NomeStore);
  private readonly clock = inject(Clock);
  private readonly title = viewChild<ElementRef<HTMLElement>>('title');

  protected readonly t = fr.cards;
  protected readonly worldId = this.store.worldId;
  protected readonly busy = this.store.busy;
  protected readonly reignOver = this.store.reignOver;
  protected readonly loaded = computed(() => this.store.nome() !== null);
  protected readonly view = computed(() => {
    const nome = this.store.nome();
    return nome === null ? null : buildCardView(nome, this.clock.now());
  });

  protected async choose(
    drawId: number,
    choice: CardChoiceView,
  ): Promise<void> {
    if (await this.store.chooseCard(drawId, choice.key)) {
      this.title()?.nativeElement.focus();
    }
  }
}
