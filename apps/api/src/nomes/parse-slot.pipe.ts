import { HttpStatus, type PipeTransform } from '@nestjs/common';
import { apiError } from '../common/api-error';

/** Parses the `:slot` segment of a parcel route. */
export class ParseSlotPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const slot = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(slot)) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'invalid_slot',
        'Le numéro de parcelle est invalide.',
      );
    }
    return slot;
  }
}
