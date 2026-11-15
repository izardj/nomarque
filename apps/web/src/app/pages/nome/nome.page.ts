import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import type { ApiErrorDto, NomeSummaryDto } from '@nomarque/contracts';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/error-message';
import { SessionStore } from '../../core/session.store';
import { fr } from '../../i18n/fr';

@Component({
  selector: 'app-nome-page',
  templateUrl: './nome.page.html',
  styleUrl: './nome.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NomePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  /** Bound from the `:id` route parameter. */
  readonly id = input.required<string>();

  protected readonly t = fr.nome;
  protected readonly common = fr.common;
  protected readonly nome = signal<NomeSummaryDto | null>(null);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.getMyNome(this.id()).subscribe({
      next: ({ nome }) => {
        if (nome === null) {
          void this.router.navigate(['/worlds', this.id(), 'join']);
          return;
        }
        this.nome.set(nome);
      },
      error: (error: ApiErrorDto) => {
        this.error.set(errorMessage(error));
      },
    });
  }

  protected dynastyAndRegion(nome: NomeSummaryDto): string {
    return fr.nome.dynastyAndRegion(
      nome.dynastyName,
      fr.regions[nome.region].label,
    );
  }

  protected deben(nome: NomeSummaryDto): string {
    return fr.nome.deben(nome.deben);
  }

  protected favor(nome: NomeSummaryDto): string {
    return fr.nome.favor(nome.favor);
  }

  protected async logout(): Promise<void> {
    await this.session.logout();
    await this.router.navigateByUrl('/login');
  }
}
