import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ApiErrorDto, JoinWorldRequest } from '@nomarque/contracts';
import { ApiService, NETWORK_ERROR_CODE } from './api.service';
import { ME_WITH_DYNASTY } from './testing';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('posts the e-mail to /api/auth/magic-link', () => {
    let result: unknown;
    api.requestMagicLink('a@b.fr').subscribe((value) => (result = value));

    const req = http.expectOne('/api/auth/magic-link');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.fr' });
    req.flush({ sent: true }, { status: 202, statusText: 'Accepted' });

    expect(result).toEqual({ sent: true });
  });

  it('posts the token to /api/auth/verify', () => {
    let result: unknown;
    api.verify('tok').subscribe((value) => (result = value));

    const req = http.expectOne('/api/auth/verify');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'tok' });
    req.flush(ME_WITH_DYNASTY);

    expect(result).toEqual(ME_WITH_DYNASTY);
  });

  it('reads the session from GET /api/auth/me', () => {
    api.me().subscribe();
    const req = http.expectOne('/api/auth/me');
    expect(req.request.method).toBe('GET');
    req.flush(ME_WITH_DYNASTY);
  });

  it('completes on logout (204)', () => {
    let completed = false;
    api.logout().subscribe({ complete: () => (completed = true) });

    const req = http.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('lists worlds and reads one world', () => {
    api.getWorlds().subscribe();
    api.getWorld('w 1').subscribe();

    expect(http.expectOne('/api/worlds').request.method).toBe('GET');
    expect(http.expectOne('/api/worlds/w%201').request.method).toBe('GET');
  });

  it('posts the join request to /api/worlds/:id/join', () => {
    const body: JoinWorldRequest = {
      region: 'delta',
      nomeName: 'Nome',
      dynastyName: 'House',
    };
    api.joinWorld('w1', body).subscribe();

    const req = http.expectOne('/api/worlds/w1/join');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ nome: null }, { status: 201, statusText: 'Created' });
  });

  it('reads my nome from /api/worlds/:id/nome', () => {
    api.getMyNome('w1').subscribe();
    const req = http.expectOne('/api/worlds/w1/nome');
    expect(req.request.method).toBe('GET');
    req.flush({ nome: null });
  });

  it('keeps the error body when the API answers with an ApiErrorDto', () => {
    const body: ApiErrorDto = {
      statusCode: 409,
      code: 'already_joined',
      message: 'already',
    };
    let error: unknown;
    api.joinWorld('w1', { region: 'delta', nomeName: 'Nome' }).subscribe({
      error: (value: unknown) => (error = value),
    });

    http
      .expectOne('/api/worlds/w1/join')
      .flush(body, { status: 409, statusText: 'Conflict' });

    expect(error).toEqual(body);
  });

  it('uses network_error when the failure has no API body', () => {
    let error: ApiErrorDto | undefined;
    api
      .getWorlds()
      .subscribe({ error: (value: ApiErrorDto) => (error = value) });

    http.expectOne('/api/worlds').error(new ProgressEvent('error'));

    expect(error?.code).toBe(NETWORK_ERROR_CODE);
  });

  it('uses network_error when the body is not an ApiErrorDto', () => {
    let error: ApiErrorDto | undefined;
    api.me().subscribe({ error: (value: ApiErrorDto) => (error = value) });

    http
      .expectOne('/api/auth/me')
      .flush('<html></html>', { status: 502, statusText: 'Bad Gateway' });

    expect(error?.code).toBe(NETWORK_ERROR_CODE);
    expect(error?.statusCode).toBe(502);
  });
});
