import type { NomeDto, PendingCardDto } from '@nomarque/contracts';
import type { CardChoiceKey, CardEffect, CardPhase } from '@nomarque/data';
import { cardDef, cardTexts, formatRemaining } from '../../core/labels';
import { fr } from '../../i18n/fr';

/** Flat colours of the provisional illustration of a card. */
export interface CardArt {
  sky: string;
  ground: string;
  sun: string;
  /** French name of the god of the card; null for a card without god. */
  god: string | null;
}

export interface CardChoiceView {
  key: CardChoiceKey;
  label: string;
  /** Effects of the choice, " ; " separators shown as " · ". */
  effect: string;
  affordable: boolean;
  /** Short reason shown when the choice cannot be taken. */
  reason: string | null;
  /** The choice only costs: its effect line is red. */
  penalty: boolean;
}

export interface CardView {
  drawId: number;
  title: string;
  text: string;
  position: string;
  art: CardArt;
  choices: CardChoiceView[];
  footnote: string;
}

const PHASE_COLORS: Readonly<
  Record<CardPhase, Pick<CardArt, 'sky' | 'ground'>>
> = {
  akhet: { sky: '#cfe3ee', ground: '#3d7ea6' },
  peret: { sky: '#efd9a8', ground: '#4a3b2c' },
  shemu: { sky: '#f3e3bd', ground: '#c9a86a' },
  any: { sky: '#efe2c6', ground: '#8c7a5e' },
};

const SUN_COLOR = '#b7791f';

/** The effect text of a choice, with its separators made readable. */
export function formatEffectText(raw: string): string {
  return raw.split(' ; ').join(' · ');
}

/** Whether an effect hurts the nome. */
export function isMalus(effect: CardEffect): boolean {
  switch (effect.kind) {
    case 'resource':
    case 'deben':
    case 'royalFavor':
    case 'godFavor':
    case 'population':
      return effect.amount < 0;
    case 'resourceShare':
    case 'harvest':
    case 'production':
    case 'idle':
      return effect.percent < 0;
    case 'tribute':
    case 'consumption':
      return effect.percent > 0;
    case 'workforce':
      return 'percent' in effect.change
        ? effect.change.percent < 0
        : effect.change.count < 0;
    case 'houseUpgrade':
      return effect.mode === 'blocked';
    case 'floodForecast':
      return false;
    case 'chance':
      return isMalus(effect.effect);
  }
}

/**
 * A choice that is a sure, fully known loss: every part of its text is a
 * structured effect, none is uncertain, and all of them hurt.
 */
export function isPenalty(
  effects: readonly CardEffect[],
  textParts: number,
): boolean {
  return (
    effects.length > 0 &&
    effects.length === textParts &&
    effects.every((effect) => effect.kind !== 'chance' && isMalus(effect))
  );
}

/** The flat illustration of a card, tinted by its phase and its god. */
export function cardArt(cardId: string): CardArt {
  const def = cardDef(cardId);
  return {
    ...PHASE_COLORS[def.phase],
    sun: SUN_COLOR,
    god: def.god === null ? null : fr.gods.names[def.god],
  };
}

/** What the player reads under the card: when the default choice applies. */
export function defaultFootnote(card: PendingCardDto, nowMs: number): string {
  const label = cardTexts(card.cardId).choices[card.defaultChoice]?.label ?? '';
  const remaining = formatRemaining(Date.parse(card.expiresAtIso), nowMs);
  return remaining === null
    ? fr.cards.defaultNow(label)
    : fr.cards.defaultIn(remaining, label);
}

/** The card at the top of the pile, as the screen shows it; null when none. */
export function buildCardView(nome: NomeDto, nowMs: number): CardView | null {
  const card = nome.cards[0];
  if (card === undefined) {
    return null;
  }
  const texts = cardTexts(card.cardId);
  const def = cardDef(card.cardId);
  const choices = card.choices.flatMap((choice): CardChoiceView[] => {
    const choiceTexts = texts.choices[choice.key];
    if (choiceTexts === undefined) {
      return [];
    }
    const effect = formatEffectText(choiceTexts.effect);
    const reason = choice.affordable ? null : fr.cards.unaffordable;
    const effects =
      def.choices.find((candidate) => candidate.key === choice.key)?.effects ??
      [];
    return [
      {
        key: choice.key,
        label: choiceTexts.label,
        effect,
        affordable: choice.affordable,
        reason,
        penalty: isPenalty(effects, choiceTexts.effect.split(' ; ').length),
      },
    ];
  });
  return {
    drawId: card.drawId,
    title: texts.title,
    text: texts.text,
    position: fr.cards.position(
      fr.phases[nome.nile.phase],
      1,
      nome.cards.length,
    ),
    art: cardArt(card.cardId),
    choices,
    footnote: defaultFootnote(card, nowMs),
  };
}
