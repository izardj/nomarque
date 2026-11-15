import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { SessionStore } from './session.store';

/** Lets logged-in players through, sends everyone else to the login page. */
export const authGuard: CanActivateFn = () => {
  if (inject(SessionStore).isLoggedIn()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login']);
};

/** Keeps logged-in players away from the login page. */
export const guestGuard: CanActivateFn = () => {
  if (inject(SessionStore).isLoggedIn()) {
    return inject(Router).createUrlTree(['/worlds']);
  }
  return true;
};
