import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NomeStore } from '../../core/nome.store';
import { fr } from '../../i18n/fr';
import { buildReportView } from './report-view';

/** What happened while the player was away, as told by the steward. */
@Component({
  selector: 'app-report-page',
  imports: [RouterLink],
  templateUrl: './report.page.html',
  styleUrl: './report.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportPage {
  private readonly store = inject(NomeStore);
  private readonly title = viewChild<ElementRef<HTMLElement>>('title');

  protected readonly t = fr.report;
  protected readonly worldId = this.store.worldId;
  protected readonly busy = this.store.busy;
  protected readonly reignOver = this.store.reignOver;
  protected readonly view = computed(() => {
    const state = this.store.state();
    return state === null ? null : buildReportView(state);
  });

  protected async acknowledge(): Promise<void> {
    if (await this.store.ackReport()) {
      this.title()?.nativeElement.focus();
    }
  }
}
