import { TestBed } from '@angular/core/testing';
import {
  Router,
  provideRouter,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { NomeStateResponse } from '@nomarque/contracts';
import { type Observable, of, throwError } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { NOME_STATE } from '../../core/testing';
import { fr } from '../../i18n/fr';
import { NomeShellPage } from './nome-shell.page';

async function setup(
  getNomeState: () => Observable<NomeStateResponse> = () => of(NOME_STATE),
) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          {
            path: 'worlds/:id/nome',
            component: NomeShellPage,
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'rapport' },
              { path: 'rapport', children: [] },
              { path: 'cite', children: [] },
            ],
          },
          { path: 'worlds/:id/join', children: [] },
        ],
        withComponentInputBinding(),
      ),
      { provide: ApiService, useValue: { getNomeState } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/worlds/w1/nome');
  await harness.fixture.whenStable();
  harness.detectChanges();
  return { harness, el: harness.routeNativeElement as HTMLElement };
}

describe('NomeShellPage', () => {
  it('shows the nome, its dynasty, its region and its wealth', async () => {
    const { el } = await setup();
    const text = el.textContent ?? '';

    expect(text).toContain('Nome du Faucon');
    expect(text).toContain('Maison des Séthides · Moyenne-Égypte');
    expect(text).toContain(fr.nome.deben(1240.4));
    expect(text).toMatch(/1\s240 deben/);
    expect(text).toContain('Faveur 86');
  });

  it('highlights the current phase of the Nile', async () => {
    const { el } = await setup();
    const labels = Array.from(el.querySelectorAll('.frieze__labels li'));

    expect(labels.map((label) => label.textContent?.trim())).toEqual([
      'Akhet',
      'Peret',
      'Shemu',
    ]);
    const current = labels.filter(
      (label) => label.getAttribute('aria-current') === 'true',
    );
    expect(current.map((label) => label.textContent?.trim())).toEqual([
      'Peret',
    ]);
    expect(el.querySelectorAll('.frieze__segment--current').length).toBe(1);
  });

  it('lists the five tabs, the last two being disabled and marked soon', async () => {
    const { el } = await setup();
    const tabs = Array.from(el.querySelectorAll('nav .tab'));

    expect(tabs.length).toBe(5);
    expect(tabs[0].textContent).toContain('Rapport');
    expect(tabs[1].textContent).toContain('Cité');
    expect(tabs[2].textContent).toContain('Ouvriers');
    for (const tab of tabs.slice(3)) {
      expect(tab.getAttribute('aria-disabled')).toBe('true');
      expect(tab.textContent).toContain('bientôt');
    }
    expect(tabs[3].textContent).toContain('Marché');
    expect(tabs[4].textContent).toContain('Nil');
  });

  it('opens the report by default and marks the current tab', async () => {
    const { harness, el } = await setup();

    expect(TestBed.inject(Router).url).toBe('/worlds/w1/nome/rapport');
    const current = el.querySelector('nav [aria-current="page"]');
    expect(current?.textContent).toContain('Rapport');

    await harness.navigateByUrl('/worlds/w1/nome/cite');
    harness.detectChanges();
    expect(
      el.querySelector('nav [aria-current="page"]')?.textContent,
    ).toContain('Cité');
  });

  it('shows the translated error when the state cannot be loaded', async () => {
    const { el } = await setup(() =>
      throwError(() => ({ statusCode: 0, code: 'network_error', message: '' })),
    );

    expect(el.textContent).toContain(fr.errors.network_error);
  });

  it('sends a player without nome to the join page', async () => {
    await setup(() =>
      throwError(() => ({ statusCode: 404, code: 'no_nome', message: '' })),
    );

    expect(TestBed.inject(Router).url).toBe('/worlds/w1/join');
  });
});
