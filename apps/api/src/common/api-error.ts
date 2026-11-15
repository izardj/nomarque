import { HttpException } from '@nestjs/common';
import type { ApiErrorDto } from '@nomarque/contracts';

/** Throws an error whose body follows ApiErrorDto. */
export function apiError(
  statusCode: number,
  code: string,
  message: string,
): HttpException {
  const body: ApiErrorDto = { statusCode, code, message };
  return new HttpException(body, statusCode);
}
