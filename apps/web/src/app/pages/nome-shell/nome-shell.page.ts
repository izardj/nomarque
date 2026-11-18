import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { NILE_PHASES } from '../../core/nile-phases';
import { NomeStore } from '../../core/nome.store';
import { fr } from '../../i18n/fr';

interface Tab {
  key: keyof typeof fr.shell.tabs;
  /** Route relative to the shell; null while the screen does not exist. */
  link: string | null;
  /** `d` attributes of the 24 × 24 line icon. */
  icon: readonly string[];
}

const TABS: readonly Tab[] = [
  {
    key: 'report',
    link: 'rapport',
    icon: [
      'M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6',
      'M6 3a2 2 0 0 0-2 2v2h4V5a2 2 0 0 0-2-2z',
      'M10 9h6M10 13h6M10 17h4',
    ],
  },
  {
    key: 'city',
    link: 'cite',
    icon: [
      'M4 3h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
      'M14 3h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
      'M4 13h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z',
      'M14 13h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z',
    ],
  },
  {
    key: 'workers',
    link: 'ouvriers',
    icon: ['M15 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M6 21v-5a6 6 0 0 1 12 0v5'],
  },
  {
    key: 'market',
    link: null,
    icon: [
      'M12 3v18M5 21h14M4 7h16',
      'M4 7l-2 6a3 3 0 0 0 6 0zM20 7l-2 6a3 3 0 0 0 6 0z',
    ],
  },
  {
    key: 'nile',
    link: null,
    icon: [
      'M2 9c3 0 3-2 6-2s3 2 6 2 3-2 6-2',
      'M2 15c3 0 3-2 6-2s3 2 6 2 3-2 6-2',
    ],
  },
];

/** Frame of the three game screens: nome header, Nile frieze, tab bar. */
@Component({
  selector: 'app-nome-shell-page',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, RouterOutlet],
  providers: [NomeStore],
  templateUrl: './nome-shell.page.html',
  styleUrl: './nome-shell.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NomeShellPage {
  private readonly store = inject(NomeStore);
  private readonly router = inject(Router);

  /** Bound from the `:id` route parameter. */
  readonly id = input.required<string>();

  protected readonly t = fr.shell;
  protected readonly common = fr.common;
  protected readonly tabs = TABS;
  protected readonly nome = this.store.nome;
  protected readonly error = this.store.error;
  protected readonly reignOver = this.store.reignOver;
  protected readonly phases = computed(() => {
    const current = this.nome()?.nile.phase;
    return NILE_PHASES.map((phase) => ({
      phase,
      label: fr.phases[phase],
      current: phase === current,
    }));
  });

  constructor() {
    effect(() => {
      const worldId = this.id();
      untracked(() => void this.loadNome(worldId));
    });
  }

  protected dynastyAndRegion(): string {
    const nome = this.nome();
    return nome === null
      ? ''
      : fr.nome.dynastyAndRegion(
          nome.dynastyName,
          fr.regions[nome.region].label,
        );
  }

  protected deben(): string {
    return fr.nome.deben(this.nome()?.deben ?? 0);
  }

  protected favor(): string {
    return fr.nome.favor(this.nome()?.favor ?? 0);
  }

  protected tabLabel(tab: Tab): string {
    return fr.shell.tabs[tab.key];
  }

  private async loadNome(worldId: string): Promise<void> {
    const loaded = await this.store.load(worldId);
    if (!loaded && this.store.failureDto()?.statusCode === 404) {
      await this.router.navigate(['/worlds', worldId, 'join']);
    }
  }
}
