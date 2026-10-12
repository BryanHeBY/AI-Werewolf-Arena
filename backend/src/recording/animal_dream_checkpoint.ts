import { z } from "zod";
import { CAT_SKIPPED_VOTE_POLICIES, PUFFER_BALLOT_POLICIES } from "@ai-werewolf-arena/game-text";
const id = z.number().int().positive().safe(),
  stock = z.record(z.string(), z.json());
/** Archive shape only; the independent ledger proves original ownership and causal values. */
export const animalCheckpointSchema = z.strictObject({
  policies: z
    .strictObject({
      skippedVotePolicy: z.enum(CAT_SKIPPED_VOTE_POLICIES),
      ballotPolicy: z.enum(PUFFER_BALLOT_POLICIES),
    })
    .nullable(),
  foxId: id,
  pufferId: id,
  catId: id,
  fox: stock,
  puffer: stock,
  cat: stock,
  stopped: z.boolean(),
  night: z
    .strictObject({
      day: id,
      status: z.enum(["starting", "open", "closing", "normal", "aborted"]),
      requiresFox: z.boolean(),
      foxPaid: z.boolean(),
    })
    .nullable(),
  effect: z
    .strictObject({ day: id, targetId: id, knifeBlocked: z.boolean(), beautyBlocked: z.boolean() })
    .nullable(),
  completedUnits: z.number().int().nonnegative().safe(),
  beautyLinkBlockedDay: id.nullable(),
  unit: z
    .strictObject({
      number: id,
      day: id,
      kind: z.enum(["exile", "skipped_day"]),
      status: z.enum(["starting", "open", "closing", "closed", "aborted"]),
      expiryPrepared: z.boolean(),
      expiryCatId: id.nullable(),
      finalRound: z.union([z.literal(1), z.literal(2)]).nullable(),
      ballots: z.array(
        z.strictObject({
          round: z.union([z.literal(1), z.literal(2)]),
          votes: z.array(
            z.strictObject({
              actorId: id,
              targetId: id.nullable(),
              abstain: z.boolean(),
              weight: z.number().nonnegative().max(1.5),
            }),
          ),
        }),
      ),
      puffer: z
        .strictObject({
          targetIds: z.array(id),
          paid: z.boolean(),
          activated: z.boolean(),
          closed: z.boolean(),
        })
        .nullable(),
    })
    .nullable(),
});
export type RecordedAnimalState = z.infer<typeof animalCheckpointSchema>;
