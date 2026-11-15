import { z } from 'zod';

export const requestMagicLinkSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
});
export type RequestMagicLinkRequest = z.infer<typeof requestMagicLinkSchema>;

/** Always the same answer, whether or not the address is known. */
export interface RequestMagicLinkResponse {
  sent: true;
}

export const verifyMagicLinkSchema = z.object({
  token: z.string().min(20).max(200),
});
export type VerifyMagicLinkRequest = z.infer<typeof verifyMagicLinkSchema>;

export interface PlayerDto {
  id: string;
  email: string;
  displayName: string | null;
}

export interface DynastyDto {
  id: string;
  name: string;
  prestige: number;
}

/** Answer of POST /auth/verify and GET /auth/me. */
export interface MeResponse {
  player: PlayerDto;
  dynasty: DynastyDto | null;
}
