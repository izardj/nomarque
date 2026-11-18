// Zod schemas mirroring libs/data/src/lib/types.ts, plus the cross-field rules
// that cannot be expressed field by field (uniqueness, references, production
// coverage).

import {
  BUILDING_IDS,
  GODS,
  HOUSE_IDS,
  REGIONS,
  RESOURCE_IDS,
  SERVICES,
  WORKER_CLASSES,
  ZONES,
  type CardEffect,
  type CardTrigger,
  type GameData,
} from '@nomarque/data';
import { z } from 'zod';

const BUILDING_KINDS = [
  'field',
  'raw',
  'workshop',
  'service',
  'storage',
  'port',
] as const;

const EXPEDITION_DESTINATIONS = ['sinai', 'byblos', 'nubia', 'punt'] as const;

const CARD_PHASES = ['any', 'akhet', 'peret', 'shemu'] as const;

const CARD_CHOICE_KEYS = ['a', 'b', 'c'] as const;

const FLOOD_LEVELS = ['low', 'good', 'high'] as const;

const TRIGGER_FAVOR_LEVELS = ['low', 'veryLow'] as const;

/** All game values must be finite and non-negative. */
const nonNegativeNumber = z.number().min(0);

const positiveNumber = z.number().positive();

const nonNegativeInteger = z.number().int().min(0);

const resourceFlowSchema = z.object({
  resource: z.enum(RESOURCE_IDS),
  perYear: nonNegativeNumber,
});

const buildingSchema = z.object({
  id: z.enum(BUILDING_IDS),
  kind: z.enum(BUILDING_KINDS),
  zones: z.array(z.enum(ZONES)).min(1),
  workerClass: z.enum(WORKER_CLASSES),
  workers: nonNegativeInteger,
  inputs: z.array(resourceFlowSchema),
  outputs: z.array(resourceFlowSchema),
  cost: z.object({ deben: nonNegativeNumber }),
  buildHours: nonNegativeNumber,
  service: z.enum(SERVICES).nullable(),
  range: nonNegativeNumber.nullable(),
});

const resourceSchema = z.object({
  id: z.enum(RESOURCE_IDS),
  tier: z.union([z.literal(1), z.literal(2), z.literal('import')]),
  referencePrice: nonNegativeNumber,
  regions: z.array(z.enum(REGIONS)),
  importFrom: z.enum(EXPEDITION_DESTINATIONS).nullable(),
  cereal: z.boolean(),
});

const houseNeedSchema = z.object({
  resource: z.enum(RESOURCE_IDS),
  perInhabitantPerYear: nonNegativeNumber,
});

const houseSchema = z.object({
  id: z.enum(HOUSE_IDS),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  inhabitants: nonNegativeInteger,
  workerClass: z.enum(WORKER_CLASSES),
  taxPerInhabitantPerYear: nonNegativeNumber,
  needs: z.array(houseNeedSchema),
  services: z.array(z.enum(SERVICES)),
  inMvp: z.boolean(),
});

const probability = z.number().gt(0).max(1);

const parametersSchema = z
  .object({
    activityRate: nonNegativeNumber,
    floodMultiplier: z.object({
      low: nonNegativeNumber,
      good: nonNegativeNumber,
      high: nonNegativeNumber,
    }),
    priceFloorFactor: nonNegativeNumber,
    priceCeilingFactor: nonNegativeNumber,
    marketTax: nonNegativeNumber,
    tributeRate: nonNegativeNumber,
    yearHours: nonNegativeNumber,
    defaultSpeed: nonNegativeNumber,
    catchUpMultiplier: nonNegativeNumber,
    inactivityDaysBeforeAbandon: nonNegativeNumber,
    registrationClosesAfterYear: nonNegativeNumber,
    baseStorage: positiveNumber,
    granaryCapacity: positiveNumber,
    housesPerBlock: positiveNumber,
    houseBlockCost: z.object({ deben: positiveNumber }),
    houseBlockBuildHours: positiveNumber,
    houseZones: z.array(z.enum(ZONES)).min(1),
    startingDeben: nonNegativeNumber,
    godFavorStart: nonNegativeNumber,
    godFavorMax: positiveNumber,
    godFavorDecayPerHour: positiveNumber,
    templeFavorPerHour: positiveNumber,
    godFavorLow: positiveNumber,
    godFavorVeryLow: positiveNumber,
    godFavorBlessing: positiveNumber,
    offeringIntervalHours: positiveNumber,
    hapyLowFloodMultiplier: positiveNumber,
    osirisHarvestShare: positiveNumber,
    bastetUpgradeHours: positiveNumber,
    cardDrawIntervalHours: positiveNumber,
    cardDrawChance: probability,
    cardMaxPending: z.number().int().min(1),
    cardGraceHours: positiveNumber,
    cardConditionalWeight: positiveNumber,
    cardRareWeight: positiveNumber,
    royalFavorHigh: positiveNumber,
    royalFavorPerTribute: positiveNumber,
    royalFavorPerMissingTribute: positiveNumber,
    prestigeFirst: positiveNumber,
    prestigeSecond: positiveNumber,
    prestigeThird: positiveNumber,
    prestigeParticipation: positiveNumber,
  })
  .superRefine((value, context) => {
    const issue = (message: string, path: string[]): void => {
      context.addIssue({ code: 'custom', message, path });
    };
    if (value.godFavorVeryLow >= value.godFavorLow) {
      issue('godFavorVeryLow must be below godFavorLow', ['godFavorVeryLow']);
    }
    if (value.godFavorLow >= value.godFavorBlessing) {
      issue('godFavorLow must be below godFavorBlessing', ['godFavorLow']);
    }
    if (value.godFavorBlessing > value.godFavorMax) {
      issue('godFavorBlessing must not exceed godFavorMax', [
        'godFavorBlessing',
      ]);
    }
    if (value.godFavorStart > value.godFavorMax) {
      issue('godFavorStart must not exceed godFavorMax', ['godFavorStart']);
    }
  });

const godIdSchema = z.enum(GODS);

const godSchema = z.object({
  id: godIdSchema,
  offering: z.object({
    resource: z.enum(RESOURCE_IDS),
    quantity: positiveNumber,
  }),
  favorPerOffering: positiveNumber,
});

const cardTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('building'), building: z.enum(BUILDING_IDS) }),
  z.object({ kind: z.literal('zone'), zone: z.enum(ZONES) }),
  z.object({ kind: z.literal('fields') }),
]);

const cardEffectSchema: z.ZodType<CardEffect> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('resource'),
      resource: z.enum(RESOURCE_IDS),
      amount: z.number(),
    }),
    z.object({
      kind: z.literal('resourceShare'),
      resource: z.enum(RESOURCE_IDS),
      percent: z.number(),
    }),
    z.object({ kind: z.literal('deben'), amount: z.number() }),
    z.object({ kind: z.literal('royalFavor'), amount: z.number() }),
    z.object({
      kind: z.literal('godFavor'),
      god: z.union([godIdSchema, z.literal('all')]),
      amount: z.number(),
    }),
    z.object({
      kind: z.literal('population'),
      workerClass: z.enum(WORKER_CLASSES),
      amount: z.number(),
    }),
    z.object({
      kind: z.literal('workforce'),
      workerClass: z.union([z.enum(WORKER_CLASSES), z.literal('all')]),
      change: z.union([
        z.object({ percent: z.number() }),
        z.object({ count: z.number() }),
      ]),
      hours: positiveNumber,
    }),
    z.object({
      kind: z.literal('idle'),
      target: cardTargetSchema,
      percent: z.number(),
      hours: positiveNumber,
    }),
    z.object({
      kind: z.literal('production'),
      resource: z.enum(RESOURCE_IDS),
      percent: z.number(),
      hours: z.union([positiveNumber, z.literal('year')]),
      startsAfter: nonNegativeNumber,
    }),
    z.object({
      kind: z.literal('consumption'),
      resource: z.enum(RESOURCE_IDS),
      percent: z.number(),
      hours: positiveNumber,
    }),
    z.object({ kind: z.literal('harvest'), percent: z.number() }),
    z.object({ kind: z.literal('tribute'), percent: z.number() }),
    z.object({
      kind: z.literal('houseUpgrade'),
      mode: z.enum(['blocked', 'fast']),
      hours: positiveNumber,
    }),
    z.object({ kind: z.literal('floodForecast'), hours: positiveNumber }),
    z.object({
      kind: z.literal('chance'),
      probability,
      effect: cardEffectSchema,
    }),
  ]),
);

const cardTriggerSchema: z.ZodType<CardTrigger> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('random') }),
  z.object({ kind: z.literal('rare') }),
  z.object({ kind: z.literal('tutorial') }),
  z.object({
    kind: z.literal('stockAbove'),
    resource: z.enum(RESOURCE_IDS),
    quantity: nonNegativeNumber,
  }),
  z.object({
    kind: z.literal('godFavorBelow'),
    god: godIdSchema,
    level: z.enum(TRIGGER_FAVOR_LEVELS),
  }),
  z.object({ kind: z.literal('royalFavorHigh') }),
  z.object({ kind: z.literal('flood'), level: z.enum(FLOOD_LEVELS) }),
  z.object({ kind: z.literal('phaseStart') }),
  z.object({ kind: z.literal('beforeTribute') }),
  z.object({
    kind: z.literal('built'),
    building: z.enum(BUILDING_IDS),
  }),
  z.object({ kind: z.literal('housesAtLeast'), count: positiveNumber }),
  z.object({
    kind: z.literal('busyWorkers'),
    workerClass: z.enum(WORKER_CLASSES),
    hours: positiveNumber,
  }),
  z.object({
    kind: z.literal('priceAbove'),
    resource: z.enum(RESOURCE_IDS),
    factor: positiveNumber,
  }),
]);

const expeditionSchema = z.object({
  id: z.string().min(1),
  destination: z.enum(EXPEDITION_DESTINATIONS),
  safe: z.boolean(),
  durationHours: nonNegativeNumber,
  costDeben: nonNegativeNumber,
  resource: z.enum(RESOURCE_IDS),
  quantity: nonNegativeNumber,
  lossRisk: z.number().min(0).max(1),
});

const cardChoiceSchema = z.object({
  key: z.enum(CARD_CHOICE_KEYS),
  effectRaw: z.string(),
  effects: z.array(cardEffectSchema),
});

const cardSchema = z.object({
  id: z.string().min(1),
  triggerRaw: z.string(),
  trigger: cardTriggerSchema,
  phase: z.enum(CARD_PHASES),
  god: z.enum(GODS).nullable(),
  choices: z.array(cardChoiceSchema).min(1),
  defaultChoice: z.enum(CARD_CHOICE_KEYS),
});

const startingContentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('building'), building: z.enum(BUILDING_IDS) }),
  z.object({ kind: z.literal('houses'), house: z.enum(HOUSE_IDS) }),
]);

const mapSlotSchema = z.object({
  slot: nonNegativeInteger,
  row: nonNegativeInteger,
  col: nonNegativeInteger,
  zone: z.enum(ZONES),
  start: startingContentSchema.nullable(),
});

function reportDuplicates(
  context: z.RefinementCtx,
  values: readonly string[],
  path: (string | number)[],
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      context.addIssue({
        code: 'custom',
        message: `duplicate identifier "${value}"`,
        path: [...path, index],
      });
    }
    seen.add(value);
  });
}

/**
 * Validates the whole game data set. Field-level rules live in the object
 * schemas below; this refinement covers references and coverage.
 */
export const gameDataSchema = z
  .object({
    version: z.string().regex(/^[0-9a-f]{12}$/, 'expected 12 hex characters'),
    resources: z.array(resourceSchema).min(1),
    buildings: z.array(buildingSchema).min(1),
    houses: z.array(houseSchema).min(1),
    parameters: parametersSchema,
    expeditions: z.array(expeditionSchema),
    cards: z.array(cardSchema).min(1),
    gods: z.array(godSchema).min(1),
    map: z.array(mapSlotSchema),
    startingStocks: z.record(z.string(), nonNegativeNumber),
  })
  .superRefine((data, context) => {
    reportDuplicates(
      context,
      data.resources.map((item) => item.id),
      ['resources'],
    );
    reportDuplicates(
      context,
      data.buildings.map((item) => item.id),
      ['buildings'],
    );
    reportDuplicates(
      context,
      data.houses.map((item) => item.id),
      ['houses'],
    );
    reportDuplicates(
      context,
      data.cards.map((item) => item.id),
      ['cards'],
    );
    reportDuplicates(
      context,
      data.expeditions.map((item) => item.id),
      ['expeditions'],
    );
    reportDuplicates(
      context,
      data.gods.map((item) => item.id),
      ['gods'],
    );

    const knownGods = new Set<string>(data.gods.map((item) => item.id));
    GODS.forEach((god) => {
      if (!knownGods.has(god)) {
        context.addIssue({
          code: 'custom',
          message: `missing god "${god}"`,
          path: ['gods'],
        });
      }
    });

    const knownResources = new Set<string>(
      data.resources.map((item) => item.id),
    );
    const producedResources = new Set<string>();
    data.buildings.forEach((building) => {
      building.outputs.forEach((flow) => {
        producedResources.add(flow.resource);
      });
    });
    data.expeditions.forEach((expedition) => {
      producedResources.add(expedition.resource);
    });

    const checkResource = (
      resource: string,
      path: (string | number)[],
      contextLabel: string,
    ): void => {
      if (!knownResources.has(resource)) {
        context.addIssue({
          code: 'custom',
          message: `${contextLabel} references unknown resource "${resource}"`,
          path,
        });
      }
    };

    data.buildings.forEach((building, buildingIndex) => {
      building.inputs.forEach((flow, flowIndex) => {
        checkResource(
          flow.resource,
          ['buildings', buildingIndex, 'inputs', flowIndex, 'resource'],
          `building "${building.id}"`,
        );
        if (!producedResources.has(flow.resource)) {
          context.addIssue({
            code: 'custom',
            message: `building "${building.id}" consumes "${flow.resource}", which no building produces and no expedition brings back`,
            path: ['buildings', buildingIndex, 'inputs', flowIndex, 'resource'],
          });
        }
      });
      building.outputs.forEach((flow, flowIndex) => {
        checkResource(
          flow.resource,
          ['buildings', buildingIndex, 'outputs', flowIndex, 'resource'],
          `building "${building.id}"`,
        );
      });
    });

    data.houses.forEach((house, houseIndex) => {
      house.needs.forEach((need, needIndex) => {
        checkResource(
          need.resource,
          ['houses', houseIndex, 'needs', needIndex, 'resource'],
          `house "${house.id}"`,
        );
        if (!producedResources.has(need.resource)) {
          context.addIssue({
            code: 'custom',
            message: `house "${house.id}" needs "${need.resource}", which no building produces and no expedition brings back`,
            path: ['houses', houseIndex, 'needs', needIndex, 'resource'],
          });
        }
      });
    });

    data.expeditions.forEach((expedition, expeditionIndex) => {
      checkResource(
        expedition.resource,
        ['expeditions', expeditionIndex, 'resource'],
        `expedition "${expedition.id}"`,
      );
    });

    const issue = (message: string, path: (string | number)[]): void => {
      context.addIssue({ code: 'custom', message, path });
    };

    data.map.forEach((slot, slotIndex) => {
      if (slot.slot !== slotIndex) {
        issue(`expected slot ${slotIndex}, found ${slot.slot}`, [
          'map',
          slotIndex,
          'slot',
        ]);
      }
    });

    const positions = new Set<string>();
    data.map.forEach((slot, slotIndex) => {
      const position = `${slot.row}:${slot.col}`;
      if (positions.has(position)) {
        issue(`duplicate map position (${slot.row}, ${slot.col})`, [
          'map',
          slotIndex,
          'col',
        ]);
      }
      positions.add(position);
    });

    const buildingsById = new Map(
      data.buildings.map((building) => [building.id, building]),
    );
    const housesById = new Map(data.houses.map((house) => [house.id, house]));

    data.map.forEach((slot, slotIndex) => {
      if (slot.start === null) {
        return;
      }
      if (slot.start.kind === 'building') {
        const building = buildingsById.get(slot.start.building);
        if (building !== undefined && !building.zones.includes(slot.zone)) {
          issue(
            `starting building "${building.id}" cannot be placed on zone "${slot.zone}"`,
            ['map', slotIndex, 'zone'],
          );
        }
        return;
      }
      const house = housesById.get(slot.start.house);
      if (house === undefined) {
        return;
      }
      if (!data.parameters.houseZones.includes(slot.zone)) {
        issue(
          `starting house "${house.id}" cannot be placed on zone "${slot.zone}"`,
          ['map', slotIndex, 'zone'],
        );
      }
      if (!house.inMvp) {
        issue(`starting house "${house.id}" is not in the MVP`, [
          'map',
          slotIndex,
          'start',
          'house',
        ]);
      }
    });

    Object.keys(data.startingStocks).forEach((resource) => {
      checkResource(resource, ['startingStocks', resource], 'starting stocks');
    });

    data.cards.forEach((card, cardIndex) => {
      if (!card.choices.some((choice) => choice.key === card.defaultChoice)) {
        context.addIssue({
          code: 'custom',
          message: `default choice "${card.defaultChoice}" is not one of the card choices`,
          path: ['cards', cardIndex, 'defaultChoice'],
        });
      }
    });
  });

export type GameDataFromSchema = z.infer<typeof gameDataSchema>;

/**
 * Compile-time guard: the schema output must keep every field of the contract.
 * Any drift between schemas.ts and types.ts fails the typecheck.
 */
type AssignableToContract<T extends GameData> = T;
export type SchemaMatchesContract = AssignableToContract<GameDataFromSchema>;
