import type {
  NomeSummaryDto,
  ReignDto,
  ReignStatusDto,
  WorldDto,
  WorldStatusDto,
} from '@nomarque/contracts';
import type { Region as RegionDto } from '@nomarque/data';
import type {
  Nome,
  Region,
  Reign,
  ReignStatus,
  World,
  WorldStatus,
} from '@nomarque/db';
import { gameHours } from '@nomarque/rules';

const REGION_TO_DTO: Record<Region, RegionDto> = {
  UPPER_EGYPT: 'upper_egypt',
  MIDDLE_EGYPT: 'middle_egypt',
  DELTA: 'delta',
};

const REGION_FROM_DTO: Record<RegionDto, Region> = {
  upper_egypt: 'UPPER_EGYPT',
  middle_egypt: 'MIDDLE_EGYPT',
  delta: 'DELTA',
};

const WORLD_STATUS_TO_DTO: Record<WorldStatus, WorldStatusDto> = {
  OPEN: 'open',
  CLOSED: 'closed',
};

const REIGN_STATUS_TO_DTO: Record<ReignStatus, ReignStatusDto> = {
  SCHEDULED: 'scheduled',
  RUNNING: 'running',
  FUNERALS: 'funerals',
  ENDED: 'ended',
};

export function regionFromDto(region: RegionDto): Region {
  return REGION_FROM_DTO[region];
}

/** Game hours elapsed in a reign at the real instant `now`. Negative before the start. */
export function reignGameHours(reign: Reign, world: World, now: Date): number {
  return gameHours(
    { startsAtMs: reign.startsAt.getTime(), speed: world.speed },
    now.getTime(),
  );
}

export function toReignDto(reign: Reign, world: World, now: Date): ReignDto {
  return {
    id: reign.id,
    number: reign.number,
    status: REIGN_STATUS_TO_DTO[reign.status],
    startsAt: reign.startsAt.toISOString(),
    endsAt: reign.endsAt.toISOString(),
    gameHours: reignGameHours(reign, world, now),
    monumentProgress: reign.monumentProgress,
  };
}

export function toWorldDto(
  world: World,
  reign: Reign | null,
  now: Date,
): WorldDto {
  return {
    id: world.id,
    name: world.name,
    speed: world.speed,
    status: WORLD_STATUS_TO_DTO[world.status],
    reign: reign ? toReignDto(reign, world, now) : null,
  };
}

export function toNomeSummaryDto(
  nome: Nome,
  dynastyName: string,
): NomeSummaryDto {
  return {
    id: nome.id,
    reignId: nome.reignId,
    name: nome.name,
    region: REGION_TO_DTO[nome.region],
    dynastyName,
    deben: nome.deben,
    favor: nome.favor,
  };
}
