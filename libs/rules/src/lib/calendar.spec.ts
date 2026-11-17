import { GAME_DATA } from '@nomarque/data';
import { nextBoundary, nextHourOfYear, phaseAt } from './calendar';

const YEAR = GAME_DATA.parameters.yearHours;

describe('phaseAt', () => {
  it.each([
    [0, 0, 'akhet', 0],
    [47.9, 0, 'akhet', 47.9],
    [48, 0, 'peret', 48],
    [119.5, 0, 'peret', 119.5],
    [120, 0, 'shemu', 120],
    [168, 1, 'akhet', 0],
    [168 * 3 + 50, 3, 'peret', 50],
  ])('at %s is year %s, %s, hour %s', (hours, year, phase, hourOfYear) => {
    expect(phaseAt(hours, YEAR)).toEqual({ year, phase, hourOfYear });
  });

  it('refuses a year too short for the calendar', () => {
    expect(() => phaseAt(0, 100)).toThrow(RangeError);
  });
});

describe('nextBoundary', () => {
  it.each([
    [0, 48, 'peret', 0],
    [48, 120, 'shemu', 0],
    [130, 168, 'akhet', 1],
    [168, 216, 'peret', 1],
  ])('after %s comes %s (%s, year %s)', (hours, at, phase, year) => {
    expect(nextBoundary(hours, YEAR)).toEqual({ at, phase, year });
  });
});

describe('nextHourOfYear', () => {
  it('is strictly after the given instant', () => {
    expect(nextHourOfYear(166, 166, YEAR)).toBe(166 + YEAR);
    expect(nextHourOfYear(165.9, 166, YEAR)).toBe(166);
  });
});
