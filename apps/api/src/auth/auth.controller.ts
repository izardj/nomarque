import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  requestMagicLinkSchema,
  verifyMagicLinkSchema,
  type MeResponse,
  type RequestMagicLinkRequest,
  type RequestMagicLinkResponse,
  type VerifyMagicLinkRequest,
} from '@nomarque/contracts';
import type { Request, Response } from 'express';
import { ENV, type Env } from '../config/env';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import { SESSION_COOKIE } from './auth.constants';
import { AuthService, type ClientMeta } from './auth.service';
import type { AuthenticatedPlayer } from './authenticated-request';
import { CurrentPlayer } from './current-player.decorator';
import { SessionGuard } from './session.guard';

const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('magic-link')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(AUTH_THROTTLE)
  async requestMagicLink(
    @Body(new ZodBodyPipe(requestMagicLinkSchema))
    body: RequestMagicLinkRequest,
    @Req() request: Request,
  ): Promise<RequestMagicLinkResponse> {
    await this.auth.requestMagicLink(
      body.email,
      clientMeta(request),
      new Date(),
    );
    return { sent: true };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async verify(
    @Body(new ZodBodyPipe(verifyMagicLinkSchema)) body: VerifyMagicLinkRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MeResponse> {
    const result = await this.auth.redeem(
      body.token,
      clientMeta(request),
      new Date(),
    );
    response.cookie(SESSION_COOKIE, result.sessionSecret, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.COOKIE_SECURE,
      path: '/',
      expires: result.sessionExpiresAt,
    });
    return result.me;
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentPlayer() player: AuthenticatedPlayer): Promise<MeResponse> {
    return this.auth.me(player.id);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  async logout(
    @CurrentPlayer() player: AuthenticatedPlayer,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(player.sessionId, new Date());
    response.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}

function clientMeta(request: Request): ClientMeta {
  return {
    ip: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  };
}
