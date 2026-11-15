import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  type ApiErrorDto,
  type JoinWorldRequest,
  type JoinWorldResponse,
  type MeResponse,
  type MyNomeResponse,
  type RequestMagicLinkRequest,
  type RequestMagicLinkResponse,
  type VerifyMagicLinkRequest,
  type WorldDto,
} from '@nomarque/contracts';
import { type Observable, catchError, map, throwError } from 'rxjs';

const API_PREFIX = '/api';

export const NETWORK_ERROR_CODE = 'network_error';

function isApiErrorDto(value: unknown): value is ApiErrorDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['code'] === 'string' &&
    typeof candidate['statusCode'] === 'number' &&
    typeof candidate['message'] === 'string'
  );
}

/** Turns anything thrown by HttpClient into the API error shape. */
export function toApiError(error: unknown): ApiErrorDto {
  if (error instanceof HttpErrorResponse) {
    if (isApiErrorDto(error.error)) {
      return error.error;
    }
    return {
      statusCode: error.status,
      code: NETWORK_ERROR_CODE,
      message: error.message,
    };
  }
  return {
    statusCode: 0,
    code: NETWORK_ERROR_CODE,
    message: error instanceof Error ? error.message : String(error),
  };
}

/** Typed client of the Nomarque API: one method per route. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  requestMagicLink(email: string): Observable<RequestMagicLinkResponse> {
    const body: RequestMagicLinkRequest = { email };
    return this.guard(
      this.http.post<RequestMagicLinkResponse>(
        `${API_PREFIX}/auth/magic-link`,
        body,
      ),
    );
  }

  verify(token: string): Observable<MeResponse> {
    const body: VerifyMagicLinkRequest = { token };
    return this.guard(
      this.http.post<MeResponse>(`${API_PREFIX}/auth/verify`, body),
    );
  }

  me(): Observable<MeResponse> {
    return this.guard(this.http.get<MeResponse>(`${API_PREFIX}/auth/me`));
  }

  logout(): Observable<void> {
    return this.guard(
      this.http
        .post<null>(`${API_PREFIX}/auth/logout`, null)
        .pipe(map(() => undefined)),
    );
  }

  getWorlds(): Observable<WorldDto[]> {
    return this.guard(this.http.get<WorldDto[]>(`${API_PREFIX}/worlds`));
  }

  getWorld(worldId: string): Observable<WorldDto> {
    return this.guard(
      this.http.get<WorldDto>(
        `${API_PREFIX}/worlds/${encodeURIComponent(worldId)}`,
      ),
    );
  }

  joinWorld(
    worldId: string,
    request: JoinWorldRequest,
  ): Observable<JoinWorldResponse> {
    return this.guard(
      this.http.post<JoinWorldResponse>(
        `${API_PREFIX}/worlds/${encodeURIComponent(worldId)}/join`,
        request,
      ),
    );
  }

  getMyNome(worldId: string): Observable<MyNomeResponse> {
    return this.guard(
      this.http.get<MyNomeResponse>(
        `${API_PREFIX}/worlds/${encodeURIComponent(worldId)}/nome`,
      ),
    );
  }

  private guard<T>(request: Observable<T>): Observable<T> {
    return request.pipe(
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }
}
