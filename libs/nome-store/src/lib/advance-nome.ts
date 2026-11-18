import { GAME_DATA } from '@nomarque/data';
import type { Prisma } from '@nomarque/db';
import { advance, mergeReports, type RulesContext } from '@nomarque/rules';
import { NomesRepository, type StoredNome } from './nomes.repository';

/**
 * Locks the nome, advances it to the game-hour instant `at` and writes the
 * result with the history of its cards, all in the transaction `tx`. A nome
 * already computed up to `at` or later is returned as stored: time never goes
 * back. Returns the state the nome now has in the database.
 */
export async function advanceNomeTo(
  nomes: NomesRepository,
  tx: Prisma.TransactionClient,
  nomeId: string,
  at: number,
  context: RulesContext,
): Promise<StoredNome> {
  await nomes.lock(tx, nomeId);
  // Read after the lock: a queued writer must see the previous one's write.
  const stored = await nomes.load(tx, nomeId);
  if (stored.computedAt >= at) {
    return stored;
  }
  const { state, report } = advance(
    stored.state,
    stored.computedAt,
    at,
    context,
  );
  const pendingReport = stored.pendingReport
    ? mergeReports(stored.pendingReport, report)
    : report;
  await nomes.save(tx, nomeId, stored.state, state, at, pendingReport);
  await nomes.recordCardsDealt(
    tx,
    nomeId,
    report.cardsDealt,
    GAME_DATA.parameters.cardGraceHours,
  );
  await nomes.recordCardsSettled(
    tx,
    nomeId,
    report.cardsDefaulted.map((card) => ({
      cardId: card.cardId,
      drawnAt: card.drawnAt,
      choice: card.choice,
      resolvedAt: card.at,
    })),
  );
  return { state, computedAt: at, pendingReport };
}
