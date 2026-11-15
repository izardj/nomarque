import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { MeResponse } from '@nomarque/contracts';
import { ENV, type Env } from '../config/env';
import { apiError } from '../common/api-error';
import { Mailer } from '../mail/mailer';
import { magicLinkMail } from '../mail/templates.fr';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAGIC_LINK_MAX_PER_WINDOW,
  MAGIC_LINK_TTL_MINUTES,
  SESSION_TOUCH_INTERVAL_MS,
  SESSION_TTL_DAYS,
} from './auth.constants';
import type { AuthenticatedPlayer } from './authenticated-request';
import { hashSecret, newSecret, normalizeEmail } from './tokens';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export interface ClientMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface RedeemResult {
  sessionSecret: string;
  sessionExpiresAt: Date;
  me: MeResponse;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Sends a single-use login link. The answer never reveals whether the address
   * is known; past the per-address quota the request is silently dropped.
   */
  async requestMagicLink(
    rawEmail: string,
    meta: ClientMeta,
    now: Date,
  ): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const windowStart = new Date(
      now.getTime() - MAGIC_LINK_TTL_MINUTES * MINUTE_MS,
    );
    const recent = await this.prisma.client.magicLinkToken.count({
      where: { email, createdAt: { gt: windowStart } },
    });
    if (recent >= MAGIC_LINK_MAX_PER_WINDOW) {
      this.logger.warn(
        `Magic link quota reached for an address (ip ${meta.ip ?? 'unknown'})`,
      );
      return;
    }

    const secret = newSecret();
    await this.prisma.client.magicLinkToken.create({
      data: {
        email,
        tokenHash: hashSecret(secret),
        expiresAt: new Date(now.getTime() + MAGIC_LINK_TTL_MINUTES * MINUTE_MS),
        requestedIp: meta.ip,
      },
    });

    const link = new URL('/login/verify', this.env.APP_URL);
    link.searchParams.set('token', secret);
    const mail = magicLinkMail(link.toString(), MAGIC_LINK_TTL_MINUTES);
    try {
      await this.mailer.send({ to: email, ...mail });
    } catch (error) {
      this.logger.error('Magic link e-mail could not be sent', error as Error);
      throw apiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'mail_unavailable',
        "L'e-mail n'a pas pu partir. Réessaie dans un instant.",
      );
    }
  }

  /** Consumes a link token and opens a session. The token works once. */
  async redeem(
    secret: string,
    meta: ClientMeta,
    now: Date,
  ): Promise<RedeemResult> {
    const tokenHash = hashSecret(secret);
    // Atomic consumption: two concurrent redemptions cannot both succeed.
    const consumed = await this.prisma.client.magicLinkToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      throw apiError(
        HttpStatus.UNAUTHORIZED,
        'invalid_token',
        'Ce lien a expiré ou a déjà servi. Demande-en un nouveau.',
      );
    }
    const token = await this.prisma.client.magicLinkToken.findUniqueOrThrow({
      where: { tokenHash },
    });

    const player = await this.prisma.client.player.upsert({
      where: { email: token.email },
      create: { email: token.email },
      update: {},
    });

    const sessionSecret = newSecret();
    const sessionExpiresAt = new Date(
      now.getTime() + SESSION_TTL_DAYS * DAY_MS,
    );
    await this.prisma.client.session.create({
      data: {
        playerId: player.id,
        tokenHash: hashSecret(sessionSecret),
        expiresAt: sessionExpiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
      },
    });

    return { sessionSecret, sessionExpiresAt, me: await this.me(player.id) };
  }

  /** The player behind a session cookie, or null when the session is not live. */
  async resolveSession(
    secret: string,
    now: Date,
  ): Promise<AuthenticatedPlayer | null> {
    const session = await this.prisma.client.session.findUnique({
      where: { tokenHash: hashSecret(secret) },
      include: { player: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= now) {
      return null;
    }
    if (
      now.getTime() - session.lastSeenAt.getTime() >
      SESSION_TOUCH_INTERVAL_MS
    ) {
      await this.prisma.client.session.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      });
    }
    return {
      id: session.player.id,
      email: session.player.email,
      displayName: session.player.displayName,
      sessionId: session.id,
    };
  }

  async logout(sessionId: string, now: Date): Promise<void> {
    await this.prisma.client.session.update({
      where: { id: sessionId },
      data: { revokedAt: now },
    });
  }

  async me(playerId: string): Promise<MeResponse> {
    const player = await this.prisma.client.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { dynasty: true },
    });
    return {
      player: {
        id: player.id,
        email: player.email,
        displayName: player.displayName,
      },
      dynasty: player.dynasty
        ? {
            id: player.dynasty.id,
            name: player.dynasty.name,
            prestige: player.dynasty.prestige,
          }
        : null,
    };
  }
}
