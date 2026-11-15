// Zod schemas mirroring libs/data/src/lib/types.ts, plus the cross-field rules
// that cannot be expressed field by field (uniqueness, references, production
// coverage).

import {
  BUILDING_IDS,
  HOUSE_IDS,
  REGIONS,
  RESOURCE_IDS,
  SERVICES,
  WORKER_CLASSES,
  ZONES,
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

const GODS = ['hapy', 'osiris', 'thoth', 'bastet', 'sekhmet'] as const;

const CARD_CHOICE_KEYS = ['a', 'b', 'c'] as const;

/** All game values must be finite and non-negative. */
const nonNegativeNumber = z.number().min(0);

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

const parametersSchema = z.object({
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
});

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
});

const cardSchema = z.object({
  id: z.string().min(1),
  triggerRaw: z.string(),
  phase: z.enum(CARD_PHASES),
  god: z.enum(GODS).nullable(),
  choices: z.array(cardChoiceSchema).min(1),
  defaultChoice: z.enum(CARD_CHOICE_KEYS),
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
        if (
          building.kind === 'workshop' &&
          !producedResources.has(flow.resource)
        ) {
          context.addIssue({
            code: 'custom',
            message: `workshop "${building.id}" consumes "${flow.resource}", which no building produces and no expedition brings back`,
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
