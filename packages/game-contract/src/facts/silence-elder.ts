/**
 * 负责定义禁言长老的已发表事实和只含已提交选择的知识数据，公共契约拥有数据格式。
 * 输入为事件名及惰性纯数据，输出脱离原对象的严格副本或 null；不会由相同字段重建夜窗、生命或表达许可。
 * Node 接入先拒绝 Proxy，浏览器调用方只传已解析 JSON；此层不承诺任意外部对象反射零副作用。
 */
import { copyEventData } from "../inert-event-data";

export const SILENCE_ELDER_POLICY = "awa_melbourne_gestures_v1" as const;
export const SILENCE_ELDER_ROLE_ID = "silence_elder" as const;
export type SilenceExpressionRound = "day" | "pk";

/** 历史只记录真实提交；翻译可为 null，不能等于被禁言者，日次严格递增。 */
export interface SilenceElderChoice {
  readonly day: number;
  readonly targetId: number;
  readonly translatorId: number | null;
}
export interface SilenceElderState {
  readonly policy: typeof SILENCE_ELDER_POLICY;
  readonly history: readonly SilenceElderChoice[];
}
type Base = { policy: typeof SILENCE_ELDER_POLICY; day: number };
type Expression = Base & { actorId: number; round: SilenceExpressionRound };
export interface SilenceElderPayloadMap {
  silence_chosen: Base & { actorId: number; targetId: number; translatorId: number | null };
  silence_announced: Base & { targetId: number; translatorId: number | null };
  silence_gesture: Expression & { description: string };
  silence_translated: Expression & { targetId: number; text: string };
  silence_translation_declined: Expression & { targetId: number };
  silence_expired: Base & { targetId: number };
}
export type SilenceElderEventType = keyof SilenceElderPayloadMap;
export type SilenceElderFact = {
  [K in SilenceElderEventType]: { readonly type: K; readonly payload: SilenceElderPayloadMap[K] };
}[SilenceElderEventType];
export const SILENCE_ELDER_EVENT_TYPES = Object.freeze([
  "silence_chosen",
  "silence_announced",
  "silence_gesture",
  "silence_translated",
  "silence_translation_declined",
  "silence_expired",
] as const);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    record(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function id(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < Number.MAX_SAFE_INTEGER
  );
}
function targetAndTranslator(value: Record<string, unknown>): boolean {
  return (
    id(value.targetId) &&
    (value.translatorId === null ||
      (id(value.translatorId) && value.translatorId !== value.targetId))
  );
}
function body(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 8192;
}

/** 仅复制历史数据；本人的记录不能据此判断目标当前生命或取得被禁言者私有知识。 */
export function readSilenceElderStateData(value: unknown): SilenceElderState | null {
  try {
    const state = copyEventData(value, 65536);
    if (
      !exact(state, ["policy", "history"]) ||
      state.policy !== SILENCE_ELDER_POLICY ||
      !Array.isArray(state.history) ||
      state.history.length > 1000
    )
      return null;
    let previousDay = 0;
    for (const choice of state.history) {
      if (
        !exact(choice, ["day", "targetId", "translatorId"]) ||
        !id(choice.day) ||
        choice.day <= previousDay ||
        !targetAndTranslator(choice)
      )
        return null;
      previousDay = choice.day;
    }
    return state as unknown as SilenceElderState;
  } catch {
    return null;
  }
}

/** 先按稳定事件名选择 schema，未知事件不读取载荷；每类事实拒绝额外私有字段。 */
export function readSilenceElderFact(type: string, payload: unknown): SilenceElderFact | null {
  if (!(SILENCE_ELDER_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(payload, 65536),
      base = ["policy", "day"];
    if (!record(p) || p.policy !== SILENCE_ELDER_POLICY || !id(p.day)) return null;
    let valid = false;
    switch (type) {
      case "silence_chosen":
        valid =
          exact(p, [...base, "actorId", "targetId", "translatorId"]) &&
          id(p.actorId) &&
          targetAndTranslator(p);
        break;
      case "silence_announced":
        valid = exact(p, [...base, "targetId", "translatorId"]) && targetAndTranslator(p);
        break;
      case "silence_gesture":
        valid =
          exact(p, [...base, "actorId", "round", "description"]) &&
          id(p.actorId) &&
          ["day", "pk"].includes(p.round as string) &&
          body(p.description);
        break;
      case "silence_translated":
      case "silence_translation_declined":
        valid =
          exact(p, [
            ...base,
            "actorId",
            "round",
            "targetId",
            ...(type === "silence_translated" ? ["text"] : []),
          ]) &&
          id(p.actorId) &&
          id(p.targetId) &&
          p.actorId !== p.targetId &&
          ["day", "pk"].includes(p.round as string) &&
          (type !== "silence_translated" || body(p.text));
        break;
      case "silence_expired":
        valid = exact(p, [...base, "targetId"]) && id(p.targetId);
        break;
    }
    return valid ? ({ type, payload: p } as SilenceElderFact) : null;
  } catch {
    return null;
  }
}

/** 分类不授予可见性；玩家 feed 仍依据真实已发表事件受众过滤。 */
export function silenceElderFactAudience(type: SilenceElderEventType): "actor" | "god" | "public" {
  if (type === "silence_chosen" || type === "silence_translation_declined") return "actor";
  return type === "silence_expired" ? "god" : "public";
}
