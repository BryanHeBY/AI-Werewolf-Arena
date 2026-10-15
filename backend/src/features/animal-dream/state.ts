/**
 * 负责子狐、河豚、白猫原资源和时钟的严格 schema、初始数据与纯转换。
 * 输入为原未知数据或已声明状态；输出维持 Node 安全副本、精确字段、顺序、大小限制和原错误。
 * 本族状态槽直接引用这些唯一工厂和 schema；本模块不写 live 容器或授权生命、目标、租约与单元。
 * 子狐 pass、河豚主动／狼刀被动及白猫延迟期限各自计付，不能用归档合法性替代运行权限。
 */
import { z } from "zod";
import { snapshotPlainData } from "../../domain/plain-data";

import { ANIMAL_DREAM_POLICY, CAT_SKIPPED_VOTE_POLICIES, type CatSkippedVotePolicy } from "@ai-werewolf-arena/game-contract";
export { ANIMAL_DREAM_POLICY } from "@ai-werewolf-arena/game-contract";
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
// 子狐至多有一次非空目标付款；历史严格递增，已付款日期必须是最后一次选择。
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
// 河豚主动至多付款一次；狼刀被动日期独立且必须晚于最后一次主动历史。
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
// 白猫 form 显式区分未揭露、延迟与到期；首次单元决定下次到期，跳过单元保留原例外。
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

/** authority 在此纯付款前已检查租约和目标；免费 pass 追加历史但不消耗一次性保护。 */
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
/** 调用方提供完整的已授权投票者集合；纯数据函数只检查其排序、非空和形状。 */
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
/** 狼刀死亡为独立被动事实；已经付款的主动报复不会禁用它，原日期检查保持。 */
export function notePufferfishKnifeDeath(value: PufferfishState, day: number): PufferfishState {
  const state = readPufferfishState(value);
  id.parse(day);
  if (state.knifeDeathDay !== null) throw Error("animal_puffer_knife_death_duplicate");
  return readPufferfishState({ ...state, knifeDeathDay: day });
}
/** 不修改 Alive；已延迟白猫继续挡掉致死提议，同时保留首次期限，不重新续时。 */
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
/** 调用方提供实际签发的终态单元回执；到期按该单元及板子政策判断，阶段文案不授予死亡。 */
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
