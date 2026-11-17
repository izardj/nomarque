import { nomeState, EMPTY_REPORT, NOME_STATE } from '../../core/testing';
import { setupScreen } from '../../core/screen-testing';
import { fr } from '../../i18n/fr';
import { ReportPage } from './report.page';

function text(el: HTMLElement): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ');
}

describe('ReportPage', () => {
  it('tells how long the player was away', async () => {
    const { el } = await setupScreen(ReportPage);
    expect(text(el)).toContain('Pendant ton absence · 9 heures');
  });

  it('writes one line per non-zero quantity', async () => {
    const { el } = await setupScreen(ReportPage);
    const lines = text(el);

    expect(lines).toContain('+72 pain');
    expect(lines).toContain('+40 bière');
    expect(lines).toContain('+200 blé · récolte');
    expect(lines).toContain("+18 deben d'impôts");
    expect(lines).toContain('−54 blé consommé');
    expect(lines).toContain('−40 blé · tribut');
  });

  it('warns about a full granary, with the plural of the lost resource', async () => {
    const { el } = await setupScreen(ReportPage);
    expect(text(el)).toContain('Grenier plein : 12 blés perdus.');
    expect(text(el)).toContain(fr.report.lostHint);
  });

  it('agrees the participle with the gender of the resource', async () => {
    const state = nomeState({
      report: {
        ...EMPTY_REPORT,
        to: 101,
        lost: { beer: 3 },
        consumed: { beer: 2 },
      },
    });
    const { el } = await setupScreen(ReportPage, state);

    expect(text(el)).toContain('Grenier plein : 3 bières perdues.');
    expect(text(el)).toContain('−2 bière consommée');
  });

  it('reports unmet needs, missing tribute, finished works and houses', async () => {
    const { el } = await setupScreen(ReportPage);
    const lines = text(el);

    expect(lines).toContain('Besoin non couvert : il a manqué 8 poisson.');
    expect(lines).toContain('Tribut incomplet : il a manqué 5 orge.');
    expect(lines).toContain('Chantier terminé : Boulangerie.');
    expect(lines).toContain('Maisons descendues au niveau 1 : Huttes ×3.');
    expect(lines).toContain(
      "Attention : Huttes ×3 manque d'un service et risque de redescendre.",
    );
  });

  it('tells about houses that went up', async () => {
    const state = nomeState({
      report: {
        ...EMPTY_REPORT,
        houseChanges: [{ slot: 4, at: 102, from: 1, to: 2 }],
      },
    });
    const { el } = await setupScreen(ReportPage, state);
    expect(text(el)).toContain('Maisons montées au niveau 2 : Huttes ×3.');
  });

  it('skips the quantities that round to zero', async () => {
    const state = nomeState({
      report: { ...EMPTY_REPORT, produced: { bread: 0.3 }, taxes: 0.2 },
    });
    const { el } = await setupScreen(ReportPage, state);
    expect(text(el)).toContain(fr.report.emptyTitle);
  });

  it('shows a calm empty state, without button, when nothing happened', async () => {
    const state = nomeState({ report: EMPTY_REPORT });
    const { el } = await setupScreen(ReportPage, state);

    expect(text(el)).toContain('Rien de neuf depuis ta dernière visite');
    expect(el.querySelector('button')).toBeNull();
    expect(text(el)).not.toContain('Pendant ton absence');
  });

  it('acknowledges the report and shows the empty state that follows', async () => {
    const answer = nomeState({ report: EMPTY_REPORT });
    const { el, api, settle } = await setupScreen(
      ReportPage,
      NOME_STATE,
      answer,
    );
    const button = el.querySelector<HTMLButtonElement>('button.ack');
    expect(button?.textContent?.trim()).toBe("C'est noté");

    button?.click();
    await settle();

    expect(api.ackReport).toHaveBeenCalledWith('w1');
    expect(text(el)).toContain(fr.report.emptyTitle);
  });
});
