import { setupScreen } from '../../core/screen-testing';
import { NOME_STATE, PENDING_CARD, withNome } from '../../core/testing';
import { CardsPage } from './cards.page';

function text(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function choices(el: HTMLElement): HTMLButtonElement[] {
  return Array.from(el.querySelectorAll<HTMLButtonElement>('.choice'));
}

const TWO_CARDS = withNome({
  cards: [PENDING_CARD, { ...PENDING_CARD, drawId: 8, cardId: 'C05' }],
});

describe('CardsPage', () => {
  it('shows the first card, its position, its texts and the default choice', async () => {
    const { el } = await setupScreen(CardsPage, TWO_CARDS);

    expect(text(el.querySelector('.position')!)).toBe('Peret · carte 1 sur 2');
    expect(text(el.querySelector('h1')!)).toBe('Le chat sacré');
    expect(text(el)).toContain('Un chat sacré dort sur le toit du grenier.');
    expect(text(el.querySelector('.footnote')!)).toBe(
      "Sans réponse dans 22 h, Méri choisira « Attendre qu'il se réveille ».",
    );
  });

  it('draws the provisional illustration without any external asset', async () => {
    const { el } = await setupScreen(CardsPage, TWO_CARDS);

    expect(el.querySelector('.art svg')).not.toBeNull();
    expect(el.querySelector('.art img')).toBeNull();
    expect(text(el.querySelector('.art__god')!)).toBe('Bastet');
  });

  it('shows one button per choice with its label and its effects', async () => {
    const { el } = await setupScreen(CardsPage, TWO_CARDS);
    const buttons = choices(el);

    expect(
      buttons.map((button) => text(button.querySelector('.choice__label')!)),
    ).toEqual(["Attendre qu'il se réveille", "L'honorer d'un poisson"]);
    expect(text(buttons[1].querySelector('.choice__effect')!)).toBe(
      'poisson -5 · Bastet +10',
    );
  });

  it('disables a choice that cannot be paid and says why', async () => {
    const { el } = await setupScreen(CardsPage, TWO_CARDS);
    const [first, second] = choices(el);

    expect(first.disabled).toBe(false);
    expect(second.disabled).toBe(true);
    expect(text(second)).toContain('Pas de quoi payer');
  });

  it('sends the draw and the key of the chosen button', async () => {
    const { el, api, settle } = await setupScreen(CardsPage, TWO_CARDS);

    choices(el)[0].click();
    await settle();

    expect(api.chooseCard).toHaveBeenCalledWith('w1', 7, { choice: 'a' });
  });

  it('does not send an unaffordable choice', async () => {
    const { el, api, settle } = await setupScreen(CardsPage, TWO_CARDS);

    choices(el)[1].click();
    await settle();

    expect(api.chooseCard).not.toHaveBeenCalled();
  });

  it('shows the next card once the choice is answered', async () => {
    const next = withNome({
      cards: [
        {
          ...PENDING_CARD,
          drawId: 8,
          cardId: 'C05',
          defaultChoice: 'c',
          choices: [
            { key: 'a', affordable: true },
            { key: 'b', affordable: true },
            { key: 'c', affordable: true },
          ],
        },
      ],
    });
    const { el, settle } = await setupScreen(CardsPage, TWO_CARDS, next);

    choices(el)[0].click();
    await settle();

    expect(text(el.querySelector('h1')!)).toBe('Les criquets');
    expect(text(el.querySelector('.position')!)).toBe('Peret · carte 1 sur 1');
    expect(choices(el).length).toBe(3);
  });

  it('shows a calm empty state with a way back to the report', async () => {
    const { el } = await setupScreen(CardsPage, NOME_STATE);

    expect(text(el)).toContain('Aucune décision en attente.');
    expect(el.querySelector('section a')?.getAttribute('href')).toBe(
      '/worlds/w1/nome/rapport',
    );
  });

  it('disables every choice once the reign is over', async () => {
    const over = withNome({
      cards: [PENDING_CARD],
      reign: { ...NOME_STATE.nome.reign, over: true },
    });
    const { el } = await setupScreen(CardsPage, over);

    expect(choices(el).every((button) => button.disabled)).toBe(true);
  });
});
