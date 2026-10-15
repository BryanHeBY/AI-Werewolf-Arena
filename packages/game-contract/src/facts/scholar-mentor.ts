/**
 * 负责学者／导师的选择、跳过、冲突与额外行动事实格式。输入为事件名和已确认的惰性数据，输出脱离原引用的记录或 null。
 * 精确键集、数值范围、可空目标与查验结果披露条件由此格式校验，复制／校验异常返回 null；冲突规则、额外资源提交与文案不在此执行。
 * 这是共享数据读取，不授予行动或修改领域状态；反射仍可执行 Proxy trap，Node 入口须先拒绝危险对象。
 */
import { copyEventData } from "../inert-event-data";
export type ModifierFactMode = "enhance" | "weaken";
export type ModifierFactKind = "check" | "guard" | "poison" | "kill";
export interface ModifierChoiceFact {
  actorId: number;
  day: number;
  mode: ModifierFactMode | null;
  targetId: number | null;
}
export interface ModifierSkipFact {
  actorId: number;
  day: number;
  reason: "first_night" | "exhausted" | "dead";
}
export interface ModifierConflictFact {
  day: number;
  kind: "same_good" | "both_wolves";
  targetId: number;
}
export interface ModifierBonusFact {
  actorId: number;
  day: number;
  kind: ModifierFactKind;
  targetId: number | null;
  abstain: boolean;
  isWerewolf?: boolean;
}
function data(value: unknown): Record<string, unknown> | null {
  try {
    const v = copyEventData(value);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
function id(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER;
}
function keys(p: Record<string, unknown>, names: string[]): boolean {
  return Object.keys(p).length === names.length && names.every((k) => Object.hasOwn(p, k));
}
export function readModifierChoiceFact(type: string, value: unknown): ModifierChoiceFact | null {
  if (type !== "modifier_choice_committed") return null;
  const p = data(value);
  return p &&
    keys(p, ["actorId", "day", "mode", "targetId"]) &&
    id(p.actorId) &&
    id(p.day) &&
    p.day >= 2 &&
    (p.mode === null
      ? p.targetId === null
      : (p.mode === "enhance" || p.mode === "weaken") && id(p.targetId))
    ? (p as unknown as ModifierChoiceFact)
    : null;
}
export function readModifierSkipFact(type: string, value: unknown): ModifierSkipFact | null {
  if (type !== "modifier_choice_skipped") return null;
  const p = data(value);
  return p &&
    keys(p, ["actorId", "day", "reason"]) &&
    id(p.actorId) &&
    id(p.day) &&
    (p.reason === "first_night" ? p.day === 1 : p.reason === "dead" || p.reason === "exhausted")
    ? (p as unknown as ModifierSkipFact)
    : null;
}
export function readModifierConflictFact(
  type: string,
  value: unknown,
): ModifierConflictFact | null {
  if (type !== "modifier_conflict_resolved") return null;
  const p = data(value);
  return p &&
    keys(p, ["day", "kind", "targetId"]) &&
    id(p.day) &&
    p.day >= 2 &&
    id(p.targetId) &&
    (p.kind === "same_good" || p.kind === "both_wolves")
    ? (p as unknown as ModifierConflictFact)
    : null;
}
// 仅非空过的查验分支披露 isWerewolf；其他分支保留原精确键集，不补查验结论。
export function readModifierBonusFact(type: string, value: unknown): ModifierBonusFact | null {
  if (type !== "modifier_bonus_resolved") return null;
  const p = data(value);
  if (
    !p ||
    !id(p.actorId) ||
    !id(p.day) ||
    p.day < 2 ||
    typeof p.kind !== "string" ||
    !["check", "guard", "poison", "kill"].includes(p.kind) ||
    typeof p.abstain !== "boolean" ||
    (p.abstain ? p.targetId !== null : !id(p.targetId))
  )
    return null;
  const checked = p.kind === "check" && !p.abstain;
  if (
    !keys(p, [
      "actorId",
      "day",
      "kind",
      "targetId",
      "abstain",
      ...(checked ? ["isWerewolf"] : []),
    ]) ||
    (checked && typeof p.isWerewolf !== "boolean")
  )
    return null;
  return p as unknown as ModifierBonusFact;
}
