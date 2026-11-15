import { TestBed } from '@angular/core/testing';
import { type Observable, Subject, of, throwError } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { fr } from '../../i18n/fr';
import { LoginPage } from './login.page';

function setup(
  requestMagicLink: (email: string) => Observable<{ sent: true }>,
) {
  const spy = vi.fn(requestMagicLink);
  TestBed.configureTestingModule({
    imports: [LoginPage],
    providers: [{ provide: ApiService, useValue: { requestMagicLink: spy } }],
  });
  const fixture = TestBed.createComponent(LoginPage);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;

  async function submit(email: string): Promise<void> {
    const input = el.querySelector<HTMLInputElement>('#login-email');
    if (input) {
      input.value = email;
      input.dispatchEvent(new Event('input'));
    }
    el.querySelector<HTMLFormElement>('form')?.dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();
    fixture.detectChanges();
  }

  return { el, spy, submit };
}

describe('LoginPage', () => {
  it('labels the e-mail field', () => {
    const { el } = setup(() => of({ sent: true }));
    expect(el.querySelector('label[for="login-email"]')?.textContent).toContain(
      fr.login.emailLabel,
    );
  });

  it('sends the trimmed e-mail and shows the confirmation', async () => {
    const { el, spy, submit } = setup(() => of({ sent: true }));
    await submit('  pharaoh@example.com ');

    expect(spy).toHaveBeenCalledWith('pharaoh@example.com');
    expect(el.textContent).toContain(fr.login.sent);
    expect(el.querySelector('form')).toBeNull();
  });

  it('disables the button while the request is pending', async () => {
    const pending = new Subject<{ sent: true }>();
    const { el, submit } = setup(() => pending);
    await submit('pharaoh@example.com');

    expect(el.querySelector('button')?.disabled).toBe(true);
  });

  it('does not call the API with an invalid e-mail', async () => {
    const { el, spy, submit } = setup(() => of({ sent: true }));
    await submit('not an email');

    expect(spy).not.toHaveBeenCalled();
    expect(el.textContent).toContain(fr.login.invalidEmail);
  });

  it('shows mail_unavailable under the field', async () => {
    const { el, submit } = setup(() =>
      throwError(() => ({
        statusCode: 503,
        code: 'mail_unavailable',
        message: 'x',
      })),
    );
    await submit('pharaoh@example.com');

    expect(el.textContent).toContain(fr.errors.mail_unavailable);
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('shows a network error', async () => {
    const { el, submit } = setup(() =>
      throwError(() => ({
        statusCode: 0,
        code: 'network_error',
        message: 'x',
      })),
    );
    await submit('pharaoh@example.com');

    expect(el.textContent).toContain(fr.errors.network_error);
  });
});
