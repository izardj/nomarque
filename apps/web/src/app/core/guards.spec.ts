import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
  Router,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { authGuard, guestGuard } from './guards';
import { SessionStore } from './session.store';

function runGuard(
  guard: typeof authGuard,
  isLoggedIn: boolean,
): { result: unknown; router: Router } {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: SessionStore, useValue: { isLoggedIn: signal(isLoggedIn) } },
    ],
  });
  const result = TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
  return { result, router: TestBed.inject(Router) };
}

function urlOf(result: unknown, router: Router): string {
  expect(result).toBeInstanceOf(UrlTree);
  return router.serializeUrl(result as UrlTree);
}

describe('authGuard', () => {
  it('lets a logged-in player through', () => {
    expect(runGuard(authGuard, true).result).toBe(true);
  });

  it('redirects a guest to /login', () => {
    const { result, router } = runGuard(authGuard, false);
    expect(urlOf(result, router)).toBe('/login');
  });
});

describe('guestGuard', () => {
  it('lets a guest through', () => {
    expect(runGuard(guestGuard, false).result).toBe(true);
  });

  it('redirects a logged-in player to /worlds', () => {
    const { result, router } = runGuard(guestGuard, true);
    expect(urlOf(result, router)).toBe('/worlds');
  });
});
