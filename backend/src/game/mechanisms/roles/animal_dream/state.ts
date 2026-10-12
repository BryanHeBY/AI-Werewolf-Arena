/** Pure native resources and clocks; the board owner separately proves lives, targets and issued units. */
import { z } from "zod";
import { snapshotPlainData } from "../../../../core/domain/plain_data";

import {
  ANIMAL_DREAM_POLICY,
  CAT_SKIPPED_VOTE_POLICIES,
  type CatSkippedVotePolicy,
} from "@ai-werewolf-arena/game-text";
export { ANIMAL_DREAM_POLICY } from "@ai-werewolf-arena/game-text";
const id = z.number().int().positive().safe();
const night = id;
const sources = z
  .array(z.enum(["wolf_kill", "exile", "charm", "puffer_retaliation"]))
  .min(1)
  .max(4)
  .refine((v) => new Set(v).size === v.length);
const ids = z
  .array(id)
  .max(12)
  .refine((v) => v.every((value, index) => index === 0 || v[index - 1]! < value));
const foxSchema = z
  .strictObject({
    policy: z.literal(ANIMAL_DREAM_POLICY),
    usedNight: night.min(2).nullable(),
    history: z.array(z.strictObject({ day: night.min(2), targetId: id.nullable() })),
  })
  .superRefine((s, ctx) => {
    const paid = s.history.filter((r) => r.targetId !== null);
    if (
      paid.length > 1 ||
      (paid[0]?.day ?? null) !== s.usedNight ||
      s.history.some((r, i) => i > 0 && r.day <= s.history[i - 1]!.day) ||
      (s.usedNight !== null && s.history.at(-1)?.day !== s.usedNight)
    )
      ctx.addIssue({ code: "custom", message: "animal_fox_state_invalid" });
  });
const pufferSchema = z
  .strictObject({
    policy: z.literal(ANIMAL_DREAM_POLICY),
    usedDay: id.nullable(),
    knifeDeathDay: id.nullable(),
    history: z.array(z.strictObject({ day: id, activate: z.boolean(), targetIds: ids })),
  })
  .superRefine((s, ctx) => {
    const paid = s.history.filter((r) => r.activate);
    if (
      paid.length > 1 ||
      (paid[0]?.day ?? null) !== s.usedDay ||
      s.history.some((r, i) => !r.targetIds.length || (i > 0 && r.day <= s.history[i - 1]!.day)) ||
      (s.usedDay !== null && s.history.at(-1)?.day !== s.usedDay) ||
      (s.knifeDeathDay !== null && (s.history.at(-1)?.day ?? 0) >= s.knifeDeathDay)
    )
      ctx.addIssue({ code: "custom", message: "animal_puffer_state_invalid" });
  });
const deferralSchema = z
  .strictObject({
    day: id,
    phase: z.enum(["night", "day", "voting"]),
    firstSources: sources,
    firstUnit: id.nullable(),
    expiresAfterUnit: id,
  })
  .refine((s) => s.firstUnit === null || s.expiresAfterUnit === s.firstUnit + 1);
const catSchema = z
  .strictObject({
    policy: z.literal(ANIMAL_DREAM_POLICY),
    form: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("veiled") }),
      z.strictObject({ kind: z.literal("deferred"), deferred: deferralSchema }),
      z.strictObject({
        kind: z.literal("expired"),
        deferred: deferralSchema,
        day: id,
        unit: id,
        unitKind: z.enum(["exile", "skipped_day"]),
      }),
    ]),
  })
  .superRefine((s, ctx) => {
    if (
      s.form.kind === "expired" &&
      (s.form.day < s.form.deferred.day ||
        (s.form.unit < s.form.deferred.expiresAfterUnit &&
          !(
            s.form.unitKind === "skipped_day" &&
            s.form.day === s.form.deferred.day &&
            s.form.deferred.firstUnit !== null &&
            s.form.unit === s.form.deferred.firstUnit
          )))
    )
      ctx.addIssue({ code: "custom", message: "animal_cat_state_invalid" });
  });
export type FoxCubState = z.infer<typeof foxSchema>;
export type PufferfishState = z.infer<typeof pufferSchema>;
export type WhiteCatState = z.infer<typeof catSchema>;
const unitSchema = z.strictObject({
  number: id,
  day: id,
  kind: z.enum(["exile", "skipped_day"]),
});
export type AnimalDeathUnit = z.infer<typeof unitSchema>;

function checked<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(snapshotPlainData(value, new Set(), 0, 65536));
}
export const readFoxCubState = (v: unknown): FoxCubState => checked(foxSchema, v);
export const readPufferfishState = (v: unknown): PufferfishState => checked(pufferSchema, v);
export const readWhiteCatState = (v: unknown): WhiteCatState => checked(catSchema, v);
export const freshFoxCubState = (): FoxCubState => ({
  policy: ANIMAL_DREAM_POLICY,
  usedNight: null,
  history: [],
});
export const freshPufferfishState = (): PufferfishState => ({
  policy: ANIMAL_DREAM_POLICY,
  usedDay: null,
  knifeDeathDay: null,
  history: [],
});
export const freshWhiteCatState = (): WhiteCatState => ({
  policy: ANIMAL_DREAM_POLICY,
  form: { kind: "veiled" },
});

/** Lease/target ownership is checked by the board owner immediately before this pure payment. */
export function payFoxCubChoice(
  value: FoxCubState,
  day: number,
  targetId: number | null,
): FoxCubState {
  const state = readFoxCubState(value);
  night.min(2).parse(day);
  id.nullable().parse(targetId);
  if (state.usedNight !== null || (state.history.at(-1)?.day ?? 0) >= day)
    throw Error("animal_fox_choice_unavailable");
  return readFoxCubState({
    ...state,
    usedNight: targetId === null ? null : day,
    history: [...state.history, { day, targetId }],
  });
}
/** The caller supplies the owner's full authorized voter set; this pure function only validates its shape. */
export function payPufferfishChoice(
  value: PufferfishState,
  day: number,
  activate: boolean,
  targetIds: readonly number[],
): PufferfishState {
  const state = readPufferfishState(value);
  id.parse(day);
  z.boolean().parse(activate);
  const targets = ids.min(1).parse(snapshotPlainData(targetIds));
  if (
    state.usedDay !== null ||
    state.knifeDeathDay !== null ||
    (state.history.at(-1)?.day ?? 0) >= day
  )
    throw Error("animal_puffer_choice_unavailable");
  return readPufferfishState({
    ...state,
    usedDay: activate ? day : null,
    history: [...state.history, { day, activate, targetIds: targets }],
  });
}
/** Independent passive fact; an already spent active reaction does not disable this. */
export function notePufferfishKnifeDeath(value: PufferfishState, day: number): PufferfishState {
  const state = readPufferfishState(value);
  id.parse(day);
  if (state.knifeDeathDay !== null) throw Error("animal_puffer_knife_death_duplicate");
  return readPufferfishState({ ...state, knifeDeathDay: day });
}
/** Never touches Alive. A pending Cat rejects further lethal proposals without renewing its clock. */
export function deferWhiteCat(
  value: WhiteCatState,
  day: number,
  phase: "night" | "day" | "voting",
  firstSources: readonly string[],
  completedUnits: number,
  currentUnit: AnimalDeathUnit | null,
): WhiteCatState {
  const state = readWhiteCatState(value);
  id.parse(day);
  z.number().int().nonnegative().safe().parse(completedUnits);
  if (state.form.kind !== "veiled") return state;
  const sourceValues = sources.parse(snapshotPlainData(firstSources)),
    ownedUnit = checked(unitSchema.nullable(), currentUnit);
  if (ownedUnit && (ownedUnit.number !== completedUnits + 1 || ownedUnit.day !== day))
    throw Error("animal_cat_unit_invalid");
  return readWhiteCatState({
    policy: ANIMAL_DREAM_POLICY,
    form: {
      kind: "deferred",
      deferred: {
        day,
        phase,
        firstSources: sourceValues,
        firstUnit: ownedUnit?.number ?? null,
        expiresAfterUnit: ownedUnit ? ownedUnit.number + 1 : completedUnits + 1,
      },
    },
  });
}
/** The manager supplies an issued terminal unit receipt, not a phase label. */
export function expireWhiteCat(
  value: WhiteCatState,
  rawUnit: AnimalDeathUnit,
  policy: CatSkippedVotePolicy,
): WhiteCatState {
  const state = readWhiteCatState(value),
    unit = checked(unitSchema, rawUnit);
  z.enum(CAT_SKIPPED_VOTE_POLICIES).parse(policy);
  if (
    state.form.kind !== "deferred" ||
    unit.day < state.form.deferred.day ||
    (unit.kind === "skipped_day" && policy === "awa_wait_for_actual_exile_v1")
  )
    return state;
  if (
    unit.number < state.form.deferred.expiresAfterUnit &&
    !(
      unit.kind === "skipped_day" &&
      unit.day === state.form.deferred.day &&
      policy === "awa_expire_on_skipped_day_v1" &&
      state.form.deferred.firstUnit !== null &&
      unit.number === state.form.deferred.firstUnit
    )
  )
    return state;
  return readWhiteCatState({
    policy: ANIMAL_DREAM_POLICY,
    form: {
      kind: "expired",
      deferred: state.form.deferred,
      day: unit.day,
      unit: unit.number,
      unitKind: unit.kind,
    },
  });
}
