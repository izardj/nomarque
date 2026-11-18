import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ApiErrorDto, JoinWorldRequest } from '@nomarque/contracts';
import { ApiService, NETWORK_ERROR_CODE } from './api.service';
import { ME_WITH_DYNASTY, NOME_STATE } from './testing';

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

  it('posts the choice of a card to /nome/cards/:drawId/choice', () => {
    api.chooseCard('w1', 7, { choice: 'b' }).subscribe();
    const req = http.expectOne('/api/worlds/w1/nome/cards/7/choice');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ choice: 'b' });
    req.flush(NOME_STATE);
  });

  it('posts an offering to /nome/offerings', () => {
    api.makeOffering('w1', { god: 'bastet' }).subscribe();
    const req = http.expectOne('/api/worlds/w1/nome/offerings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ god: 'bastet' });
    req.flush(NOME_STATE);
  });

  it('posts a crop to /nome/parcels/:slot/crop', () => {
    api.chooseCrop('w1', 8, { crop: 'farm_flax' }).subscribe();
    const req = http.expectOne('/api/worlds/w1/nome/parcels/8/crop');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ crop: 'farm_flax' });
    req.flush(NOME_STATE);
  });

  it('reads the nome state from GET /nome/state', () => {
    api.getNomeState('w1').subscribe();
    const req = http.expectOne('/api/worlds/w1/nome/state');
    expect(req.request.method).toBe('GET');
    req.flush(NOME_STATE);
  });

  it('posts a build request to the parcel', () => {
    api.build('w1', 5, { kind: 'building', building: 'bakery' }).subscribe();
    const req = http.expectOne('/api/worlds/w1/nome/parcels/5/build');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ kind: 'building', building: 'bakery' });
    req.flush(NOME_STATE);
  });

  it('posts the worker count to the parcel', () => {
    api.assignWorkers('w1', 2, { workers: 4 }).subscribe();
    const req = http.expectOne('/api/worlds/w1/nome/parcels/2/workers');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ workers: 4 });
    req.flush(NOME_STATE);
  });

  it('acknowledges the report', () => {
    api.ackReport('w1').subscribe();
    const req = http.expectOne('/api/worlds/w1/nome/report/ack');
    expect(req.request.method).toBe('POST');
    req.flush(NOME_STATE);
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
