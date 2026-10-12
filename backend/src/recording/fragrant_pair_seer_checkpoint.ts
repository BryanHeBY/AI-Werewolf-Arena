/**
 * Responsibility: validate the serialized fragrant-pair knowledge checkpoint shape.
 * Input: unknown archived checkpoint data.
 * Output: the strict shape schema and detached validated knowledge DTO.
 * Boundary: inert data never carries a runtime component identity or action permission.
 */
import { z } from "zod";
import {
  FRAGRANT_PAIR_POLICY,
  readFragrantKnownState,
} from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
/** God checkpoint shape only. The archive ledger independently computes its values. */
const id = z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER - 2),
  pair = z.tuple([id, id]).refine(([a, b]) => a < b),
  choice = z.strictObject({ day: id, pairIds: pair.nullable() });
const binding = z.strictObject({
  id: z.string(),
  createdNight: id,
  expiresNight: id,
  pairIds: pair,
  status: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("pending") }),
    z.strictObject({ kind: z.enum(["expired", "triggered"]), day: id }),
  ]),
});
export const fragrantCheckpointSchema = z.strictObject({
  phantomId: id,
  seerId: id,
  fragrant: z.strictObject({
    policy: z.literal(FRAGRANT_PAIR_POLICY),
    knownWolfId: id.nullable(),
    knowledgeNight: z.literal(1).nullable(),
    lastChoice: choice.nullable(),
    bindings: z.array(binding),
    trigger: z
      .strictObject({ bindingId: z.string(), day: id, rootId: id, addedTargetId: id.nullable() })
      .nullable(),
  }),
  pairSeer: z.strictObject({
    policy: z.literal(FRAGRANT_PAIR_POLICY),
    history: z.array(z.strictObject({ day: id, targetIds: pair, containsWerewolf: z.boolean() })),
  }),
  known: z
    .strictObject({
      knownWolfId: id.nullable(),
      lastOpenedNight: z.number().int().nonnegative(),
      lastChoice: choice.nullable(),
      activeBinding: z
        .strictObject({ createdNight: id, expiresNight: id, pairIds: pair })
        .nullable(),
      used: z.boolean(),
      knifeNotices: z.array(z.strictObject({ day: id, eligible: z.boolean() })),
    })
    .refine((v) => readFragrantKnownState(v) !== null),
  nights: z.array(
    z.strictObject({
      day: id,
      status: z.enum(["open", "normal", "aborted"]),
      knife: z.boolean(),
      bindCommitted: z.boolean(),
      pairCommitted: z.boolean(),
    }),
  ),
});
export type RecordedFragrantState = z.infer<typeof fragrantCheckpointSchema>;
