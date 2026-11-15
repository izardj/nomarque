import type { MeResponse } from '@nomarque/contracts';

export const ME_WITHOUT_DYNASTY: MeResponse = {
  player: { id: 'p1', email: 'pharaoh@example.com', displayName: null },
  dynasty: null,
};

export const ME_WITH_DYNASTY: MeResponse = {
  player: { id: 'p1', email: 'pharaoh@example.com', displayName: null },
  dynasty: { id: 'd1', name: 'Existing House', prestige: 3 },
};
