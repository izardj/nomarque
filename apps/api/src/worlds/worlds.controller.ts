import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  joinWorldSchema,
  type JoinWorldRequest,
  type JoinWorldResponse,
  type MyNomeResponse,
  type WorldDto,
} from '@nomarque/contracts';
import type { AuthenticatedPlayer } from '../auth/authenticated-request';
import { CurrentPlayer } from '../auth/current-player.decorator';
import { SessionGuard } from '../auth/session.guard';
import { CLOCK, type Clock } from '../common/clock';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import { WorldsService } from './worlds.service';

@Controller('worlds')
@UseGuards(SessionGuard)
export class WorldsController {
  constructor(
    private readonly worlds: WorldsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  list(): Promise<WorldDto[]> {
    return this.worlds.listOpen(new Date(this.clock.now()));
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<WorldDto> {
    return this.worlds.get(id, new Date(this.clock.now()));
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.CREATED)
  join(
    @Param('id') id: string,
    @Body(new ZodBodyPipe(joinWorldSchema)) body: JoinWorldRequest,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<JoinWorldResponse> {
    return this.worlds.join(player.id, id, body, new Date(this.clock.now()));
  }

  @Get(':id/nome')
  myNome(
    @Param('id') id: string,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<MyNomeResponse> {
    return this.worlds.myNome(player.id, id);
  }
}
