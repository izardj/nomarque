import {
  HttpStatus,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { apiError } from '../common/api-error';
import type { AuthenticatedRequest } from './authenticated-request';
import { AuthService } from './auth.service';
import { SESSION_COOKIE } from './auth.constants';

/** Rejects requests without a live session and attaches the player. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies = request.cookies as
      Record<string, string | undefined> | undefined;
    const secret = cookies?.[SESSION_COOKIE];
    const player = secret
      ? await this.auth.resolveSession(secret, new Date())
      : null;
    if (!player) {
      throw apiError(
        HttpStatus.UNAUTHORIZED,
        'not_authenticated',
        'Connexion requise.',
      );
    }
    request.player = player;
    return true;
  }
}
