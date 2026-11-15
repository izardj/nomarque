import { TestBed } from '@angular/core/testing';
import { type Observable, of, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { SessionStore } from './session.store';
import { ME_WITH_DYNASTY } from './testing';

function setup(
  api: Partial<Record<'me' | 'logout', () => Observable<unknown>>>,
): SessionStore {
  TestBed.configureTestingModule({
    providers: [{ provide: ApiService, useValue: api }],
  });
  return TestBed.inject(SessionStore);
}

const unauthorized = {
  statusCode: 401,
  code: 'unauthorized',
  message: 'no session',
};

describe('SessionStore', () => {
  it('starts logged out', () => {
    const store = setup({});
    expect(store.me()).toBeNull();
    expect(store.isLoggedIn()).toBe(false);
  });

  it('is logged in once /auth/me answers', async () => {
    const store = setup({ me: () => of(ME_WITH_DYNASTY) });
    await store.load();
    expect(store.me()).toEqual(ME_WITH_DYNASTY);
    expect(store.isLoggedIn()).toBe(true);
  });

  it('stays logged out on 401', async () => {
    const store = setup({ me: () => throwError(() => unauthorized) });
    await store.load();
    expect(store.me()).toBeNull();
    expect(store.isLoggedIn()).toBe(false);
  });

  it('is logged out after a failed reload', async () => {
    let fail = false;
    const store = setup({
      me: () => (fail ? throwError(() => unauthorized) : of(ME_WITH_DYNASTY)),
    });
    await store.load();
    fail = true;
    await store.load();
    expect(store.isLoggedIn()).toBe(false);
  });

  it('takes the player returned by verify', () => {
    const store = setup({});
    store.setMe(ME_WITH_DYNASTY);
    expect(store.isLoggedIn()).toBe(true);
  });

  it('clears the session on logout, even when the call fails', async () => {
    const store = setup({
      logout: () => throwError(() => unauthorized),
    });
    store.setMe(ME_WITH_DYNASTY);
    await store.logout();
    expect(store.isLoggedIn()).toBe(false);
  });
});
