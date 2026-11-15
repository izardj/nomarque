import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { ApiErrorDto, JoinWorldRequest } from '@nomarque/contracts';
import { REGIONS, type Region } from '@nomarque/data';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/error-message';
import { SessionStore } from '../../core/session.store';
import { fr } from '../../i18n/fr';

/** Mirrors the server-side limits of the join contract. */
const NAME_MIN = 2;
const NAME_MAX = 40;

function pickDynastyProposal(): string {
  const proposals = fr.join.dynastyProposals;
  return proposals[Math.floor(Math.random() * proposals.length)];
}

@Component({
  selector: 'app-world-join-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './world-join.page.html',
  styleUrl: './world-join.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorldJoinPage {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  /** Bound from the `:id` route parameter. */
  readonly id = input.required<string>();

  protected readonly t = fr.join;
  protected readonly common = fr.common;
  protected readonly enterLabel = fr.worlds.enter;
  protected readonly regions = REGIONS.map((id) => ({
    id,
    ...fr.regions[id],
  }));

  /** The dynasty is only asked once, at the player's first nome. */
  protected readonly needsDynasty = computed(
    () => this.session.me()?.dynasty == null,
  );

  protected readonly form = new FormGroup({
    region: new FormControl<Region | null>(null, [Validators.required]),
    nomeName: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(NAME_MIN),
        Validators.maxLength(NAME_MAX),
      ],
    }),
    dynastyName: new FormControl(pickDynastyProposal(), {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(NAME_MIN),
        Validators.maxLength(NAME_MAX),
      ],
    }),
  });

  protected readonly submitting = signal(false);
  protected readonly error = signal<ApiErrorDto | null>(null);
  protected readonly errorText = computed(() => {
    const error = this.error();
    return error === null ? null : errorMessage(error);
  });
  protected readonly validationText = signal<string | null>(null);

  constructor() {
    if (!this.needsDynasty()) {
      this.form.controls.dynastyName.disable();
    }
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    const { region, nomeName, dynastyName } = this.form.controls;
    nomeName.setValue(nomeName.value.trim());
    dynastyName.setValue(dynastyName.value.trim());

    this.error.set(null);
    this.validationText.set(null);
    const selectedRegion = region.value;
    if (selectedRegion === null) {
      this.validationText.set(fr.join.regionRequired);
      return;
    }
    if (nomeName.invalid) {
      this.validationText.set(fr.join.nomeNameInvalid);
      return;
    }
    if (dynastyName.enabled && dynastyName.invalid) {
      this.validationText.set(fr.join.dynastyNameInvalid);
      return;
    }

    const request: JoinWorldRequest = {
      region: selectedRegion,
      nomeName: nomeName.value,
      ...(dynastyName.enabled ? { dynastyName: dynastyName.value } : {}),
    };
    this.submitting.set(true);
    this.api.joinWorld(this.id(), request).subscribe({
      next: () => {
        void this.enterNome();
      },
      error: (error: ApiErrorDto) => {
        this.submitting.set(false);
        this.error.set(error);
      },
    });
  }

  /** Refreshes the session (the dynasty now exists), then opens the nome. */
  private async enterNome(): Promise<void> {
    await this.session.load();
    await this.router.navigate(['/worlds', this.id(), 'nome']);
  }
}
