import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { ApiErrorDto } from '@nomarque/contracts';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/error-message';
import { SessionStore } from '../../core/session.store';
import { fr } from '../../i18n/fr';

type VerifyStatus = 'checking' | 'failed';

@Component({
  selector: 'app-login-verify-page',
  imports: [RouterLink],
  templateUrl: './login-verify.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginVerifyPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  /** Bound from the `token` query parameter of the e-mailed link. */
  readonly token = input<string | undefined>(undefined);

  protected readonly t = fr.verify;
  protected readonly status = signal<VerifyStatus>('checking');
  protected readonly message = signal<string>(fr.verify.checking);

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      this.fail(fr.verify.missingToken);
      return;
    }
    this.api.verify(token).subscribe({
      next: (me) => {
        this.session.setMe(me);
        void this.router.navigateByUrl('/worlds');
      },
      error: (error: ApiErrorDto) => {
        this.fail(errorMessage(error));
      },
    });
  }

  private fail(message: string): void {
    this.status.set('failed');
    this.message.set(message);
  }
}
