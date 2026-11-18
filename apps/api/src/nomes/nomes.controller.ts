import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  assignWorkersRequestSchema,
  buildRequestSchema,
  cardChoiceRequestSchema,
  cropRequestSchema,
  offeringRequestSchema,
  type AssignWorkersRequest,
  type BuildRequest,
  type CardChoiceRequest,
  type CropRequest,
  type OfferingRequest,
  type NomeStateResponse,
} from '@nomarque/contracts';
import type { AuthenticatedPlayer } from '../auth/authenticated-request';
import { CurrentPlayer } from '../auth/current-player.decorator';
import { SessionGuard } from '../auth/session.guard';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import { NomesService } from './nomes.service';
import { ParseDrawIdPipe, ParseSlotPipe } from './parse-slot.pipe';

@Controller('worlds/:id/nome')
@UseGuards(SessionGuard)
export class NomesController {
  constructor(private readonly nomes: NomesService) {}

  @Get('state')
  state(
    @Param('id') id: string,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<NomeStateResponse> {
    return this.nomes.read(player.id, id);
  }

  @Post('parcels/:slot/build')
  build(
    @Param('id') id: string,
    @Param('slot', new ParseSlotPipe()) slot: number,
    @Body(new ZodBodyPipe(buildRequestSchema)) body: BuildRequest,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<NomeStateResponse> {
    return this.nomes.build(player.id, id, slot, body);
  }

  @Post('parcels/:slot/workers')
  assignWorkers(
    @Param('id') id: string,
    @Param('slot', new ParseSlotPipe()) slot: number,
    @Body(new ZodBodyPipe(assignWorkersRequestSchema))
    body: AssignWorkersRequest,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<NomeStateResponse> {
    return this.nomes.assignWorkers(player.id, id, slot, body);
  }

  @Post('parcels/:slot/crop')
  chooseCrop(
    @Param('id') id: string,
    @Param('slot', new ParseSlotPipe()) slot: number,
    @Body(new ZodBodyPipe(cropRequestSchema)) body: CropRequest,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<NomeStateResponse> {
    return this.nomes.chooseCrop(player.id, id, slot, body);
  }

  @Post('offerings')
  makeOffering(
    @Param('id') id: string,
    @Body(new ZodBodyPipe(offeringRequestSchema)) body: OfferingRequest,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<NomeStateResponse> {
    return this.nomes.makeOffering(player.id, id, body);
  }

  @Post('cards/:drawId/choice')
  chooseCard(
    @Param('id') id: string,
    @Param('drawId', new ParseDrawIdPipe()) drawId: number,
    @Body(new ZodBodyPipe(cardChoiceRequestSchema)) body: CardChoiceRequest,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<NomeStateResponse> {
    return this.nomes.chooseCard(player.id, id, drawId, body);
  }

  @Post('report/ack')
  acknowledgeReport(
    @Param('id') id: string,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<NomeStateResponse> {
    return this.nomes.acknowledgeReport(player.id, id);
  }
}
