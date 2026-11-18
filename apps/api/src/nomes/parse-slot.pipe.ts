import { HttpStatus, type PipeTransform } from '@nestjs/common';
import { apiError } from '../common/api-error';

/** A route segment holding a non-negative integer. */
function parseIndex(value: string, code: string, message: string): number {
  const index = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(index)) {
    throw apiError(HttpStatus.BAD_REQUEST, code, message);
  }
  return index;
}

/** Parses the `:slot` segment of a parcel route. */
export class ParseSlotPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    return parseIndex(
      value,
      'invalid_slot',
      'Le numéro de parcelle est invalide.',
    );
  }
}

/** Parses the `:drawId` segment of an event card route. */
export class ParseDrawIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    return parseIndex(
      value,
      'invalid_draw',
      'Le numéro de carte est invalide.',
    );
  }
}
