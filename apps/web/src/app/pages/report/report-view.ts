import type {
  NomeStateResponse,
  ParcelDto,
  ResourceAmountsDto,
} from '@nomarque/contracts';
import {
  agree,
  amountEntries,
  formatNumber,
  parcelName,
  plural,
  resourceLabel,
} from '../../core/labels';
import type { ResourceId } from '@nomarque/data';
import { fr } from '../../i18n/fr';

const MINUS = '−';

/** A quantity gained or spent: "+72 pain". */
export interface Tally {
  key: string;
  gain: boolean;
  amount: string;
  label: string;
}

/** A sentence about something that happened. */
export interface Note {
  key: string;
  tone: 'good' | 'bad' | 'neutral';
  text: string;
}

export interface ReportView {
  away: string;
  tallies: Tally[];
  notes: Note[];
  /** Whether the storage hint follows the notes. */
  storageHint: boolean;
  /** Nothing to tell: no line at all. */
  empty: boolean;
}

function tallies(
  prefix: string,
  amounts: ResourceAmountsDto,
  gain: boolean,
  suffix: (resource: ResourceId, count: number) => string,
): Tally[] {
  return amountEntries(amounts).map(({ resource, quantity }) => {
    const sign = gain ? '+' : MINUS;
    const word = suffix(resource, Math.abs(quantity));
    return {
      key: `${prefix}-${resource}`,
      gain,
      amount: `${sign}${formatNumber(Math.abs(quantity))}`,
      label: `${resourceLabel(resource)}${word}`,
    };
  });
}

function parcelAt(parcels: ParcelDto[], slot: number): string {
  const parcel = parcels.find((candidate) => candidate.slot === slot);
  return (parcel && parcelName(parcel)) ?? fr.report.unknownParcel;
}

/** Turns the server report into the lines of the steward's screen. */
export function buildReportView({
  nome,
  report,
}: NomeStateResponse): ReportView {
  const t = fr.report;
  const none = () => '';
  const taxes = Math.round(report.taxes);

  const lines: Tally[] = [
    ...tallies('produced', report.produced, true, none),
    ...tallies('harvested', report.harvested, true, () => ` · ${t.harvested}`),
    ...(taxes === 0
      ? []
      : [
          {
            key: 'taxes',
            gain: taxes > 0,
            amount: `${taxes > 0 ? '+' : MINUS}${formatNumber(Math.abs(taxes))}`,
            label: t.taxes,
          },
        ]),
    ...tallies(
      'consumed',
      report.consumed,
      false,
      (resource, count) => ` ${agree(t.consumedWord, resource, count)}`,
    ),
    ...tallies('tribute', report.tribute, false, () => ` · ${t.tribute}`),
  ];

  const notes: Note[] = [
    ...amountEntries(report.lost).map(({ resource, quantity }) => ({
      key: `lost-${resource}`,
      tone: 'bad' as const,
      text: t.lost(
        formatNumber(quantity),
        plural(resourceLabel(resource), quantity),
        agree(t.lostWord, resource, quantity),
      ),
    })),
    ...amountEntries(report.tributeMissing).map(({ resource, quantity }) => ({
      key: `tribute-missing-${resource}`,
      tone: 'bad' as const,
      text: t.tributeMissing(formatNumber(quantity), resourceLabel(resource)),
    })),
    ...amountEntries(report.shortages).map(({ resource, quantity }) => ({
      key: `shortage-${resource}`,
      tone: 'bad' as const,
      text: t.shortage(formatNumber(quantity), resourceLabel(resource)),
    })),
    ...report.completed.map((slot) => ({
      key: `completed-${slot}`,
      tone: 'good' as const,
      text: t.completed(parcelAt(nome.parcels, slot)),
    })),
    ...report.houseChanges.map((change) => {
      const up = change.to > change.from;
      const name = parcelAt(nome.parcels, change.slot);
      return {
        key: `house-${change.slot}-${change.at}`,
        tone: up ? ('good' as const) : ('bad' as const),
        text: up ? t.houseUp(name, change.to) : t.houseDown(name, change.to),
      };
    }),
    ...report.houseWarnings.map((warning) => ({
      key: `warning-${warning.slot}-${warning.at}`,
      tone: 'bad' as const,
      text: t.houseWarning(parcelAt(nome.parcels, warning.slot)),
    })),
  ];

  return {
    away: t.away(Math.round(report.to - report.from)),
    tallies: lines,
    notes,
    storageHint: amountEntries(report.lost).length > 0,
    empty: lines.length === 0 && notes.length === 0,
  };
}
