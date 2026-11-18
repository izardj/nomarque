import type {
  GodDto,
  ModifierDto,
  NileDto,
  NomeDto,
} from '@nomarque/contracts';
import { type CardEffect, type God, GAME_DATA, GODS } from '@nomarque/data';
import {
  buildingLabel,
  formatRemaining,
  resourceLabel,
} from '../../core/labels';
import { fr } from '../../i18n/fr';

const MINUS = '−';

export interface GaugeView {
  /** Fill of the gauge, 0..100. */
  percent: number;
  /** Positions of the two thresholds on the gauge, 0..100. */
  lowAt: number;
  blessingAt: number;
  value: number;
  max: number;
  valueText: string;
}

export interface OfferingView {
  label: string;
  /** Spoken name of the button, with the god. */
  ariaLabel: string;
  disabled: boolean;
  /** Why the button is disabled, when the player can do something about it. */
  reason: string | null;
}

export interface GodView {
  god: God;
  name: string;
  domain: string;
  standing: GodDto['standing'];
  standingLabel: string;
  gauge: GaugeView;
  offering: OfferingView;
}

export interface NileView {
  yearAndPhase: string;
  flood: string;
  nextFlood: string | null;
  crops: string;
}

export interface ModifierView {
  key: string;
  text: string;
  /** Time left, or that the effect has not started yet. */
  until: string;
}

function share(value: number, max: number): number {
  return Math.min(100, Math.max(0, (value / max) * 100));
}

/** The favour gauge of a god, with the thresholds of the game data. */
export function gaugeView(favor: number): GaugeView {
  const { godFavorMax, godFavorLow, godFavorBlessing } = GAME_DATA.parameters;
  return {
    percent: share(favor, godFavorMax),
    lowAt: share(godFavorLow, godFavorMax),
    blessingAt: share(godFavorBlessing, godFavorMax),
    value: Math.round(favor),
    max: godFavorMax,
    valueText: fr.gods.gaugeValue(favor, godFavorMax),
  };
}

/** What the offering button of a god says and whether it can be pressed. */
export function offeringView(
  nome: NomeDto,
  god: God,
  nowMs: number,
): OfferingView {
  const def = GAME_DATA.gods.find((candidate) => candidate.id === god);
  if (def === undefined) {
    throw new Error(`Unknown god: ${god}`);
  }
  const { resource, quantity } = def.offering;
  const label = fr.gods.offer(
    quantity,
    resourceLabel(resource),
    def.favorPerOffering,
  );
  const ariaLabel = fr.gods.offerFor(label, fr.gods.names[god]);

  if (nome.reign.over) {
    return { label, ariaLabel, disabled: true, reason: null };
  }
  if (nome.nextOfferingAtIso !== null) {
    const remaining = formatRemaining(
      Date.parse(nome.nextOfferingAtIso),
      nowMs,
    );
    if (remaining !== null) {
      return {
        label,
        ariaLabel,
        disabled: true,
        reason: fr.gods.offeringIn(remaining),
      };
    }
  }
  if ((nome.stocks[resource] ?? 0) < quantity) {
    return {
      label,
      ariaLabel,
      disabled: true,
      reason: fr.gods.notEnough(resourceLabel(resource)),
    };
  }
  return { label, ariaLabel, disabled: false, reason: null };
}

/** The five gods, in the order of the game data. */
export function godViews(nome: NomeDto, nowMs: number): GodView[] {
  return GODS.map((god) => ({
    god,
    name: fr.gods.names[god],
    domain: fr.gods.domains[god],
    standing: nome.gods[god].standing,
    standingLabel: fr.gods.standings[nome.gods[god].standing],
    gauge: gaugeView(nome.gods[god].favor),
    offering: offeringView(nome, god, nowMs),
  }));
}

/** The Nile panel: year, flood, early forecast and the crop deadline. */
export function nileView(nile: NileDto, nowMs: number): NileView {
  let crops: string = fr.nile.cropsLocked;
  if (!nile.cropsLocked) {
    const remaining =
      nile.nextPhase === 'peret'
        ? formatRemaining(Date.parse(nile.nextPhaseAtIso), nowMs)
        : null;
    crops =
      remaining === null ? fr.nile.cropsOpenSoon : fr.nile.cropsOpen(remaining);
  }
  return {
    yearAndPhase: fr.nile.yearAndPhase(nile.year + 1, fr.phases[nile.phase]),
    flood: fr.nile.flood(fr.nile.floods[nile.flood]),
    nextFlood:
      nile.nextFlood === null
        ? null
        : fr.nile.nextFlood(fr.nile.floods[nile.nextFlood]),
    crops,
  };
}

/** "−20 %" / "+10 %" with the typographic minus. */
function signedPercent(percent: number): string {
  return `${percent < 0 ? MINUS : '+'}${Math.abs(percent)} %`;
}

function signedCount(count: number): string {
  return `${count < 0 ? MINUS : '+'}${Math.abs(count)}`;
}

/** A lasting card effect, worded for the list of active effects. */
export function describeModifier(effect: CardEffect): string {
  const t = fr.gods.modifier;
  switch (effect.kind) {
    case 'workforce': {
      const change =
        'percent' in effect.change
          ? signedPercent(effect.change.percent)
          : signedCount(effect.change.count);
      return effect.workerClass === 'all'
        ? t.workforceAll(change)
        : t.workforce(fr.workerClasses[effect.workerClass].title, change);
    }
    case 'idle': {
      const who =
        effect.target.kind === 'building'
          ? buildingLabel(effect.target.building)
          : effect.target.kind === 'zone'
            ? fr.zones[effect.target.zone]
            : t.fields;
      return effect.percent <= -100
        ? t.stopped(who)
        : t.idle(who, signedPercent(effect.percent));
    }
    case 'production':
      return t.production(
        resourceLabel(effect.resource),
        signedPercent(effect.percent),
      );
    case 'consumption':
      return t.consumption(
        resourceLabel(effect.resource),
        signedPercent(effect.percent),
      );
    case 'houseUpgrade':
      return effect.mode === 'blocked' ? t.housesBlocked : t.housesFast;
    default:
      return fr.gods.modifierFallback;
  }
}

/** The lasting effects of the cards, with their time left. */
export function modifierViews(nome: NomeDto, nowMs: number): ModifierView[] {
  return nome.modifiers.map((modifier: ModifierDto, index) => {
    const remaining = formatRemaining(Date.parse(modifier.endsAtIso), nowMs);
    const ends =
      remaining === null
        ? fr.gods.modifierEndsSoon
        : fr.gods.modifierEnds(remaining);
    return {
      key: `${index}-${modifier.startsAt}`,
      text: describeModifier(modifier.effect),
      until:
        modifier.startsAt > nome.gameHours
          ? `${fr.gods.modifierPending} · ${ends}`
          : ends,
    };
  });
}
