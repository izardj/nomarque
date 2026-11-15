import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import type { ApiErrorDto } from '@nomarque/contracts';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/error-message';
import { fr } from '../../i18n/fr';

type LoginStatus = 'idle' | 'sending' | 'sent';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly api = inject(ApiService);

  protected readonly t = fr.login;
  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });
  protected readonly status = signal<LoginStatus>('idle');
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.status() === 'sending') {
      return;
    }
    const email = this.form.controls.email;
    email.setValue(email.value.trim());
    if (email.invalid) {
      this.error.set(fr.login.invalidEmail);
      return;
    }
    this.error.set(null);
    this.status.set('sending');
    this.api.requestMagicLink(email.value).subscribe({
      next: () => {
        this.status.set('sent');
      },
      error: (error: ApiErrorDto) => {
        this.status.set('idle');
        this.error.set(errorMessage(error));
      },
    });
  }
}
