import { z } from "zod";
/** Serialized God state contract. It neither executes production state transitions nor
 * supplies an oracle: the independent ledger computes the expected values. */
const positive = z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER - 2),
  day = positive;
const choice = z.strictObject({ day, targetId: positive.nullable() });
const contract = z.strictObject({
  id: z.string(),
  targetId: positive,
  createdNight: day,
  expiresNight: day,
  status: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("pending") }),
    z.strictObject({ kind: z.enum(["cleared", "expired", "target_dead"]), day }),
  ]),
});
const wolfPolicy = z.enum(["standard", "no_blast_no_self_knife"]),
  repeatPolicy = z.enum(["awa_nonconsecutive_nights_v1", "awa_repeat_v1"]);
const cause = z.enum([
  "wolf_kill",
  "poison",
  "demon_hunt",
  "demon_hunt_backlash",
  "servant_expiry",
]);
const noble = z.strictObject({
  policy: z.literal("awa_noble_secret_body_v1"),
  wolfActionPolicy: wolfPolicy,
  lastChoice: choice.nullable(),
  contracts: z.array(contract),
});
const body = z.strictObject({
  policy: z.literal("awa_noble_secret_body_v1"),
  protectionRepeatPolicy: repeatPolicy,
  lastChoice: choice.nullable(),
  body: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("intact") }),
    z.strictObject({ kind: z.literal("night_spent"), day, targetId: positive, cause }),
    z.strictObject({ kind: z.literal("exile_revealed"), day }),
  ]),
});
const nobleKnown = z.strictObject({
  wolfActionPolicy: wolfPolicy,
  lastNotifiedNight: z.number().int().nonnegative(),
  lastChoice: choice.nullable(),
  contracts: z.array(contract),
});
const bodyKnown = z.strictObject({
  protectionRepeatPolicy: repeatPolicy,
  lastNotifiedNight: z.number().int().nonnegative(),
  lastChoice: choice.nullable(),
  resource: z.enum(["intact", "spent", "exile_revealed"]),
  publicRevealDay: day.nullable(),
});
export const nobleBodyCheckpointSchema = z.strictObject({
  nobleId: positive,
  bodyId: positive,
  noble,
  body,
  knowledge: z.strictObject({ noble: nobleKnown, body: bodyKnown }),
  notices: z.array(
    z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("night_noble"), actorId: positive, day, known: nobleKnown }),
      z.strictObject({ kind: z.literal("secret_body"), actorId: positive, day, known: bodyKnown }),
    ]),
  ),
  nights: z.array(
    z.strictObject({
      day,
      status: z.enum(["open", "normal", "aborted"]),
      bodyChosen: z.boolean(),
      nobleChosen: z.boolean(),
      expiryProcessed: z.boolean(),
      bodyResolved: z.boolean(),
      revealOpened: z.boolean(),
      revealCompleted: z.boolean(),
    }),
  ),
});
export type RecordedNobleBodyState = z.infer<typeof nobleBodyCheckpointSchema>;
