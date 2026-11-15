import type { GameParameters } from '@nomarque/data';

/**
 * Nile years in a reign. Fixed by the technical spec ("une saison de 4 années
 * du Nil"); not yet a column of parametres.csv.
 */
export const REIGN_YEARS = 4;

/** Length of a whole reign in game hours. */
export function reignLengthHours(
  parameters: Pick<GameParameters, 'yearHours'>,
): number {
  return REIGN_YEARS * parameters.yearHours;
}
