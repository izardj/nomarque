// Plays a whole reign against the running API and worker, with bot players,
// on a world fast enough for the reign to fit in minutes. It checks the J2
// milestone: a complete reign, without errors.
//
// Usage: tsx tools/reign-sim/src/main.ts [--minutes 30] [--players 4]
// Needs the API (API_URL, default http://localhost:3000/api), the worker,
// PostgreSQL and Redis running, with DATABASE_URL in the environment.

import { createHash, randomBytes } from 'node:crypto';
import type { NomeDto, NomeStateResponse } from '@nomarque/contracts';
import {
  GAME_DATA,
  GODS,
  REGIONS,
  type BuildingId,
  type Zone,
} from '@nomarque/data';
import { createPrismaClient, createReign } from '@nomarque/db';
import { REIGN_YEARS } from '@nomarque/rules';

const API_URL = process.env['API_URL'] ?? 'http://localhost:3000/api';
const SESSION_COOKIE = 'nomarque_session';
const WEEK_MS = 7 * 24 * 3600 * 1000;

interface Options {
  minutes: number;
  players: number;
}

function options(): Options {
  const args = process.argv.slice(2);
  const value = (name: string, fallback: number): number => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? Number(args[index + 1]) : fallback;
  };
  return { minutes: value('minutes', 30), players: value('players', 4) };
}

interface Tally {
  requests: number;
  /** Refusals by code: expected game answers (422). */
  refusals: Map<string, number>;
  /** 4xx other than 422 and every 5xx: bugs. */
  errors: string[];
  actions: Map<string, number>;
}

class Bot {
  constructor(
    readonly name: string,
    private readonly cookie: string,
    private readonly ip: string,
    private readonly worldId: string,
    private readonly tally: Tally,
  ) {}

  async join(): Promise<void> {
    const response = await this.call('POST', `/worlds/${this.worldId}/join`, {
      region: pick(REGIONS),
      dynastyName: `Dynastie ${this.name}`,
      nomeName: `Nome ${this.name}`,
    });
    if (!response.ok) {
      throw new Error(`${this.name} could not join: ${response.status}`);
    }
  }

  /**
   * One session of the player. Returns false once the reign is over: either
   * the nome says so, or the worker already closed the reign and the world
   * runs the next one, where this player has no nome yet.
   */
  async play(): Promise<boolean> {
    const response = await this.call(
      'GET',
      `/worlds/${this.worldId}/nome/state`,
      undefined,
      404,
    );
    if (response.status === 404) {
      return false;
    }
    if (!response.ok) {
      return true;
    }
    let state = (await response.json()) as NomeStateResponse;
    if (state.nome.reign.over) {
      return false;
    }
    for (const card of state.nome.cards) {
      const affordable = card.choices.filter((c) => c.affordable);
      const choice = pick(affordable.length > 0 ? affordable : card.choices);
      state =
        (await this.act('card', `nome/cards/${card.drawId}/choice`, {
          choice: choice.key,
        })) ?? state;
    }
    state = (await this.offer(state.nome)) ?? state;
    state = (await this.staff(state.nome)) ?? state;
    state = (await this.swapCrop(state.nome)) ?? state;
    await this.build(state.nome);
    await this.act('ack', 'nome/report/ack');
    return true;
  }

  private async offer(nome: NomeDto): Promise<NomeStateResponse | null> {
    if (nome.nextOfferingAt !== null) {
      return null;
    }
    const gods = [...GODS].sort(
      (a, b) => nome.gods[a].favor - nome.gods[b].favor,
    );
    for (const god of gods) {
      const def = GAME_DATA.gods.find((g) => g.id === god);
      const stock = def ? (nome.stocks[def.offering.resource] ?? 0) : 0;
      if (def && stock >= def.offering.quantity) {
        return this.act('offering', 'nome/offerings', { god });
      }
    }
    return null;
  }

  private async staff(nome: NomeDto): Promise<NomeStateResponse | null> {
    let last: NomeStateResponse | null = null;
    for (const parcel of nome.parcels) {
      if (!parcel.building || parcel.buildEndsAt !== null) {
        continue;
      }
      const required =
        GAME_DATA.buildings.find((b) => b.id === parcel.building)?.workers ?? 0;
      if (parcel.workers !== required) {
        last =
          (await this.act('workers', `nome/parcels/${parcel.slot}/workers`, {
            workers: required,
          })) ?? last;
      }
    }
    return last;
  }

  private async swapCrop(nome: NomeDto): Promise<NomeStateResponse | null> {
    if (nome.nile.cropsLocked || Math.random() > 0.3) {
      return null;
    }
    const field = nome.parcels.find(
      (p) => p.building === 'farm_wheat' || p.building === 'farm_barley',
    );
    if (!field || field.buildEndsAt !== null) {
      return null;
    }
    const crop = field.building === 'farm_wheat' ? 'farm_barley' : 'farm_wheat';
    return this.act('crop', `nome/parcels/${field.slot}/crop`, { crop });
  }

  private async build(nome: NomeDto): Promise<void> {
    const empty = nome.parcels.filter((p) => !p.building && !p.houses);
    if (empty.length === 0) {
      return;
    }
    const parcel = pick(empty);
    const target = buildFor(parcel.zone, nome);
    const cost =
      target === 'houses'
        ? GAME_DATA.parameters.houseBlockCost.deben
        : (GAME_DATA.buildings.find((b) => b.id === target)?.cost.deben ?? 0);
    if (nome.deben < cost + 50) {
      return;
    }
    await this.act(
      'build',
      `nome/parcels/${parcel.slot}/build`,
      target === 'houses'
        ? { kind: 'houses' }
        : { kind: 'building', building: target },
    );
  }

  private async act(
    action: string,
    path: string,
    body?: object,
  ): Promise<NomeStateResponse | null> {
    const response = await this.call(
      'POST',
      `/worlds/${this.worldId}/${path}`,
      body,
    );
    if (response.ok) {
      this.tally.actions.set(action, (this.tally.actions.get(action) ?? 0) + 1);
      return (await response.json()) as NomeStateResponse;
    }
    return null;
  }

  private async call(
    method: string,
    path: string,
    body?: object,
    expected?: number,
  ): Promise<Response> {
    this.tally.requests++;
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Cookie: `${SESSION_COOKIE}=${this.cookie}`,
        'X-Forwarded-For': this.ip,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 422) {
      const { code } = (await response.clone().json()) as { code: string };
      this.tally.refusals.set(code, (this.tally.refusals.get(code) ?? 0) + 1);
    } else if (!response.ok && response.status !== expected) {
      this.tally.errors.push(
        `${this.name} ${method} ${path} → ${response.status} ${await response.clone().text()}`,
      );
    }
    return response;
  }
}

function buildFor(zone: Zone, nome: NomeDto): BuildingId | 'houses' {
  const has = (id: BuildingId): boolean =>
    nome.parcels.some((p) => p.building === id);
  switch (zone) {
    case 'city':
      if (!has('temple')) {
        return 'temple';
      }
      return has('bakery') ? 'houses' : 'bakery';
    case 'black_land':
      return Math.random() < 0.5 ? 'farm_barley' : 'farm_wheat';
    case 'river':
      return 'fishery';
    case 'desert':
      return 'houses';
  }
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const { minutes, players } = options();
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  const prisma = createPrismaClient(databaseUrl);
  // Years per real week so that the whole reign lasts `minutes`.
  const speed = (REIGN_YEARS * WEEK_MS) / (minutes * 60_000);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const world = await prisma.world.create({
    data: { name: `Simulation ${stamp}`, speed, status: 'OPEN' },
  });
  const reign = await prisma.$transaction((tx) =>
    createReign(tx, world, new Date(), new Date()),
  );
  const floods = await prisma.nileYear.findMany({
    where: { reignId: reign.id },
    orderBy: { index: 'asc' },
  });
  console.log(
    `world ${world.name}: speed ${speed.toFixed(1)}, reign ${reign.number} until ${reign.endsAt.toISOString()}, floods ${floods.map((f) => f.floodLevel).join(' ')}`,
  );
  console.log(
    'Start (or restart) the worker now so that it schedules this reign.',
  );

  const tally: Tally = {
    requests: 0,
    refusals: new Map(),
    errors: [],
    actions: new Map(),
  };
  const bots: Bot[] = [];
  for (let i = 0; i < players; i++) {
    const player = await prisma.player.create({
      data: { email: `sim-${stamp}-${i}@example.org` },
    });
    const secret = randomBytes(32).toString('base64url');
    await prisma.session.create({
      data: {
        playerId: player.id,
        tokenHash: createHash('sha256').update(secret).digest('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });
    const bot = new Bot(`Bot${i}`, secret, `10.9.0.${i + 1}`, world.id, tally);
    await bot.join();
    bots.push(bot);
  }

  // Each bot plays about every 6 game hours, with some jitter.
  const gameHourMs =
    (minutes * 60_000) / (REIGN_YEARS * GAME_DATA.parameters.yearHours);
  const running = bots.map(async (bot) => {
    for (;;) {
      await sleep(gameHourMs * (3 + Math.random() * 6));
      if (!(await bot.play())) {
        return;
      }
    }
  });
  const progress = setInterval(() => {
    const done = Math.min(
      100,
      ((Date.now() - reign.startsAt.getTime()) /
        (reign.endsAt.getTime() - reign.startsAt.getTime())) *
        100,
    );
    console.log(
      `${done.toFixed(0)} % · ${tally.requests} requests · ${tally.errors.length} errors`,
    );
  }, 60_000);
  await Promise.all(running);
  clearInterval(progress);

  // The worker closes the reign: wait for it.
  let ended = await prisma.reign.findUniqueOrThrow({ where: { id: reign.id } });
  for (let i = 0; i < 120 && ended.status !== 'ENDED'; i++) {
    await sleep(1000);
    ended = await prisma.reign.findUniqueOrThrow({ where: { id: reign.id } });
  }
  const nomes = await prisma.nome.findMany({
    where: { reignId: reign.id },
    include: { dynasty: true },
  });
  const rankings = await prisma.reignRanking.findMany({
    where: { reignId: reign.id },
    orderBy: [{ category: 'asc' }, { rank: 'asc' }],
  });
  const next = await prisma.reign.findFirst({
    where: { worldId: world.id, number: reign.number + 1 },
  });
  const revealed = await prisma.nileYear.count({
    where: { reignId: reign.id, revealedAt: { not: null } },
  });
  const draws = await prisma.eventCardDraw.groupBy({
    by: ['choice'],
    where: { nome: { reignId: reign.id } },
    _count: true,
  });

  const checks: [string, boolean][] = [
    ['reign ENDED', ended.status === 'ENDED'],
    [
      'every nome advanced to the end',
      nomes.every(
        (n) => n.computedAt === REIGN_YEARS * GAME_DATA.parameters.yearHours,
      ),
    ],
    ['3 rankings × every nome', rankings.length === 3 * nomes.length],
    ['prestige paid', nomes.every((n) => n.dynasty.prestige > 0)],
    ['next reign created', next !== null],
    ['every flood revealed', revealed === REIGN_YEARS],
    ['no HTTP error', tally.errors.length === 0],
  ];

  console.log('\nActions:', Object.fromEntries(tally.actions));
  console.log('Refusals (422):', Object.fromEntries(tally.refusals));
  console.log(
    'Card history by choice:',
    draws.map((d) => `${d.choice ?? 'pending'}: ${d._count}`).join(', '),
  );
  console.log('Rankings:');
  for (const line of rankings) {
    const nome = nomes.find((n) => n.id === line.nomeId);
    console.log(
      `  ${line.category} #${line.rank} ${nome?.name} ${line.score.toFixed(1)} (+${line.prestige})`,
    );
  }
  for (const error of tally.errors.slice(0, 20)) {
    console.log('ERROR', error);
  }
  console.log(`\n${tally.requests} requests`);
  for (const [label, ok] of checks) {
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`);
  }
  await prisma.$disconnect();
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
