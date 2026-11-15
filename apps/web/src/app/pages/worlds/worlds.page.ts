import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type {
  ApiErrorDto,
  NomeSummaryDto,
  WorldDto,
} from '@nomarque/contracts';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/error-message';
import { SessionStore } from '../../core/session.store';
import { fr } from '../../i18n/fr';

interface WorldEntry {
  world: WorldDto;
  /** The player's nome in this world, null when not joined yet. */
  nome: NomeSummaryDto | null;
}

type LoadStatus = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-worlds-page',
  imports: [RouterLink],
  templateUrl: './worlds.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorldsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly t = fr.worlds;
  protected readonly common = fr.common;
  protected readonly status = signal<LoadStatus>('loading');
  protected readonly error = signal<string | null>(null);
  protected readonly entries = signal<WorldEntry[]>([]);

  ngOnInit(): void {
    this.api
      .getWorlds()
      .pipe(
        map((worlds) => worlds.filter((world) => world.status === 'open')),
        switchMap((worlds) =>
          worlds.length === 0
            ? of<WorldEntry[]>([])
            : forkJoin(
                worlds.map((world) =>
                  this.api.getMyNome(world.id).pipe(
                    map((response) => response.nome),
                    catchError(() => of(null)),
                    map((nome): WorldEntry => ({ world, nome })),
                  ),
                ),
              ),
        ),
      )
      .subscribe({
        next: (entries) => {
          this.entries.set(entries);
          this.status.set('ready');
        },
        error: (error: ApiErrorDto) => {
          this.error.set(errorMessage(error));
          this.status.set('error');
        },
      });
  }

  protected speed(world: WorldDto): string {
    return fr.worlds.speed(world.speed);
  }

  protected reign(world: WorldDto): string {
    if (world.reign === null) {
      return fr.worlds.noReign;
    }
    return fr.worlds.reign(
      world.reign.number,
      fr.worlds.reignStatus[world.reign.status],
    );
  }

  protected async logout(): Promise<void> {
    await this.session.logout();
    await this.router.navigateByUrl('/login');
  }
}
