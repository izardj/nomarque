import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedPlayer,
  AuthenticatedRequest,
} from './authenticated-request';

/** The player attached by SessionGuard. Only valid on guarded routes. */
export const CurrentPlayer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPlayer =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().player,
);
