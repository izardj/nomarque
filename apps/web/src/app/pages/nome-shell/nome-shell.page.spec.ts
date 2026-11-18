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
import { NOME_STATE, PENDING_CARD, withNome } from '../../core/testing';
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
              { path: 'cartes', children: [] },
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

  it('lists the seven tabs in session order, the last two being disabled and marked soon', async () => {
    const { el } = await setup();
    const tabs = Array.from(el.querySelectorAll('nav .tab'));

    expect(tabs.length).toBe(7);
    expect(tabs.map((tab) => tab.textContent?.trim().split(/\s+/)[0])).toEqual([
      'Rapport',
      'Cartes',
      'Ouvriers',
      'Cité',
      'Dieux',
      'Marché',
      'Nil',
    ]);
    for (const tab of tabs.slice(5)) {
      expect(tab.getAttribute('aria-disabled')).toBe('true');
      expect(tab.textContent).toContain('bientôt');
    }
  });

  it('badges the cards tab with the number of pending cards', async () => {
    const withCards = withNome({
      cards: [PENDING_CARD, { ...PENDING_CARD, drawId: 8 }],
    });
    const { el } = await setup(() => of(withCards));
    const tab = el.querySelector('nav a[href$="/cartes"]');

    expect(tab?.querySelector('.tab__badge')?.textContent?.trim()).toBe('2');
    expect(tab?.getAttribute('aria-label')).toBe('Cartes, 2 cartes en attente');
  });

  it('shows no badge without pending card', async () => {
    const { el } = await setup();
    expect(el.querySelector('.tab__badge')).toBeNull();
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

  it('shows no banner while the reign runs', async () => {
    const { el } = await setup();
    expect(el.querySelector('.banner')).toBeNull();
  });

  it('announces the end of the reign', async () => {
    const over = withNome({ reign: { ...NOME_STATE.nome.reign, over: true } });
    const { el } = await setup(() => of(over));

    expect(el.querySelector('.banner')?.textContent).toContain(
      'Le règne est terminé.',
    );
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
