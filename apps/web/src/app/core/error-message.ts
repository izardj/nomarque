import type { ApiErrorDto } from '@nomarque/contracts';
import { fr } from '../i18n/fr';

const messages: Readonly<Record<string, string>> = fr.errors;

/** Translates an API error code into a French message. */
export function errorMessage(error: ApiErrorDto): string {
  return messages[error.code] ?? fr.errors.unknown;
}
