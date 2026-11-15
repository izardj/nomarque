import type { Request } from 'express';

export interface AuthenticatedPlayer {
  id: string;
  email: string;
  displayName: string | null;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  player: AuthenticatedPlayer;
}
