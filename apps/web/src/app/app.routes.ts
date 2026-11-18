import { Route } from '@angular/router';
import { authGuard, guestGuard } from './core/guards';

export const appRoutes: Route[] = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'login/verify',
    loadComponent: () =>
      import('./pages/login-verify/login-verify.page').then(
        (m) => m.LoginVerifyPage,
      ),
  },
  {
    path: 'worlds',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/worlds/worlds.page').then((m) => m.WorldsPage),
  },
  {
    path: 'worlds/:id/join',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/world-join/world-join.page').then((m) => m.WorldJoinPage),
  },
  {
    path: 'worlds/:id/nome',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/nome-shell/nome-shell.page').then((m) => m.NomeShellPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'rapport' },
      {
        path: 'rapport',
        loadComponent: () =>
          import('./pages/report/report.page').then((m) => m.ReportPage),
      },
      {
        path: 'cartes',
        loadComponent: () =>
          import('./pages/cards/cards.page').then((m) => m.CardsPage),
      },
      {
        path: 'cite',
        loadComponent: () =>
          import('./pages/city/city.page').then((m) => m.CityPage),
      },
      {
        path: 'dieux',
        loadComponent: () =>
          import('./pages/gods/gods.page').then((m) => m.GodsPage),
      },
      {
        path: 'ouvriers',
        loadComponent: () =>
          import('./pages/workers/workers.page').then((m) => m.WorkersPage),
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'worlds' },
  { path: '**', redirectTo: 'worlds' },
];
