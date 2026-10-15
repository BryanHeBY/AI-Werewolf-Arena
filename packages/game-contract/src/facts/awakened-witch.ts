/**
 * 负责觉醒女巫夜间选择与秘密协作的纯数据契约。输入为惰性历史数据，输出严格脱离副本或 null。
 * 原始历史是唯一资源凭据：解药次数、调毒序号和已参与名单均从历史推导，不另存可漂移的库存镜像。
 * 此处拥有格式，不拥有 World、协作会话或行动许可；完整私态只供God归档，玩家投影须另行裁剪。
 */
import { copyEventData } from "../inert-event-data";

export const AWAKENED_WITCH_POLICY = "awa_awakened_witch_v1" as const;
export const AWAKENED_WITCH_ROLE_ID = "awakened_witch" as const;
export interface BrewDiscussion {
  readonly actorId: number;
  readonly text: string;
}
export interface BrewApproval {
  readonly actorId: number;
  readonly approve: boolean;
}
export type AwakenedWitchNight =
  | { readonly day: number; readonly mode: "pass" }
  | { readonly day: number; readonly mode: "heal"; readonly targetId: number }
  | {
      readonly day: number;
      readonly mode: "poison";
      readonly ordinal: 1 | 2 | 3;
      readonly targetId: number;
      readonly assistantIds: readonly number[];
      readonly discussions: readonly BrewDiscussion[];
      readonly approvals: readonly BrewApproval[];
      /** building可包含全部已接受决定；最终提案尚未付款的失败前缀不能伪造成正常否决。 */
      readonly outcome: "building" | "vetoed" | "poison";
    };
export interface AwakenedWitchState {
  readonly policy: typeof AWAKENED_WITCH_POLICY;
  readonly nights: readonly AwakenedWitchNight[];
}
/** 本人知道已付选择及资格消耗；不包含讨论、秘密批准或成功与否。 */
export interface AwakenedWitchKnowledge {
  readonly policy: typeof AWAKENED_WITCH_POLICY;
  readonly healRemaining: 0 | 1;
  readonly brewRemaining: 0 | 1 | 2 | 3;
  readonly usedAssistantIds: readonly number[];
  readonly history: readonly (
    | { readonly day: number; readonly mode: "pass" }
    | { readonly day: number; readonly mode: "heal"; readonly targetId: number }
    | {
        readonly day: number;
        readonly mode: "poison";
        readonly targetId: number;
        readonly ordinal: 1 | 2 | 3;
        readonly assistantIds: readonly number[];
      }
  )[];
}

function exact(v: unknown, keys: readonly string[]): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    keys.every((key) => Object.hasOwn(v, key))
  );
}
function id(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER;
}

/** 历史逐夜复制，嵌套协作不放宽既有事件reader的全局深度政策；根和数组只读自有数据描述符。 */
function copyState(value: unknown): { policy: unknown; nights: unknown[] } | null {
  if (!exact(value, ["policy", "nights"]) || Object.getOwnPropertySymbols(value).length)
    return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const fields = Object.getOwnPropertyDescriptors(value);
  if (!Object.values(fields).every((d) => "value" in d && d.enumerable)) return null;
  const nights: unknown = fields.nights!.value;
  if (!Array.isArray(nights) || Object.getPrototypeOf(nights) !== Array.prototype) return null;
  const entries = Object.getOwnPropertyDescriptors(nights),
    length: unknown = Object.getOwnPropertyDescriptor(nights, "length")?.value;
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > 1000 ||
    Reflect.ownKeys(nights).length !== length + 1
  )
    return null;
  const rows: unknown[] = [];
  for (let i = 0; i < length; i++) {
    const field = entries[String(i)];
    if (!field || !("value" in field) || !field.enumerable) return null;
    rows.push(copyEventData(field.value, 16));
  }
  return { policy: copyEventData(fields.policy!.value), nights: rows };
}

/** 跨夜检查真实参与资格及第k次人数；未知键、重复夜、重复协助、假库存和假一致结果均拒绝。 */
export function readAwakenedWitchStateData(value: unknown): AwakenedWitchState | null {
  try {
    const s = copyState(value);
    if (
      !exact(s, ["policy", "nights"]) ||
      s.policy !== AWAKENED_WITCH_POLICY ||
      !Array.isArray(s.nights) ||
      s.nights.length > 1000
    )
      return null;
    let previousDay = 0,
      brews = 0,
      heals = 0;
    const used = new Set<number>();
    for (const [index, raw] of s.nights.entries()) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const n = raw as Record<string, unknown>;
      if (!id(n.day) || n.day <= previousDay) return null;
      previousDay = n.day;
      if (n.mode === "pass") {
        if (!exact(n, ["day", "mode"])) return null;
        continue;
      }
      if (n.mode === "heal") {
        if (!exact(n, ["day", "mode", "targetId"]) || !id(n.targetId) || ++heals > 1) return null;
        continue;
      }
      if (
        n.mode !== "poison" ||
        !exact(n, [
          "day",
          "mode",
          "ordinal",
          "targetId",
          "assistantIds",
          "discussions",
          "approvals",
          "outcome",
        ]) ||
        ++brews > 3 ||
        n.ordinal !== brews ||
        !id(n.targetId) ||
        !Array.isArray(n.assistantIds) ||
        n.assistantIds.length !== brews ||
        !n.assistantIds.every(id) ||
        new Set(n.assistantIds).size !== brews ||
        n.assistantIds.some((who) => used.has(who)) ||
        !Array.isArray(n.discussions) ||
        n.discussions.length > brews ||
        !Array.isArray(n.approvals) ||
        n.approvals.length > brews ||
        !["building", "vetoed", "poison"].includes(n.outcome as string)
      )
        return null;
      const assistants = n.assistantIds as number[];
      for (const who of assistants) used.add(who);
      for (const [index, discussion] of n.discussions.entries())
        if (
          !exact(discussion, ["actorId", "text"]) ||
          discussion.actorId !== assistants[index] ||
          typeof discussion.text !== "string" ||
          discussion.text.length > 8192
        )
          return null;
      const approved = new Set<number>();
      for (const approval of n.approvals) {
        if (
          !exact(approval, ["actorId", "approve"]) ||
          !id(approval.actorId) ||
          !assistants.includes(approval.actorId) ||
          approved.has(approval.actorId) ||
          typeof approval.approve !== "boolean" ||
          n.discussions.length !== brews
        )
          return null;
        approved.add(approval.actorId);
      }
      if (n.outcome !== "building") {
        if (n.approvals.length !== brews) return null;
        const unanimous = n.approvals.every((a: { approve: boolean }) => a.approve);
        if ((n.outcome === "poison") !== unanimous) return null;
      } else if (index !== s.nights.length - 1) return null;
    }
    return s as unknown as AwakenedWitchState;
  } catch {
    return null;
  }
}

/** 本人可知资源摘要只有自身已付选择；从完整协作历史推导时不带出别人的发言、决定或结果。 */
export function awakenedWitchResources(state: AwakenedWitchState): {
  healRemaining: 0 | 1;
  brewRemaining: 0 | 1 | 2 | 3;
  usedAssistantIds: readonly number[];
} {
  const brews = state.nights.filter((n) => n.mode === "poison");
  return {
    healRemaining: state.nights.some((n) => n.mode === "heal") ? 0 : 1,
    brewRemaining: (3 - brews.length) as 0 | 1 | 2 | 3,
    usedAssistantIds: brews.flatMap((n) => (n.mode === "poison" ? [...n.assistantIds] : [])),
  };
}

interface BrewBase {
  readonly policy: typeof AWAKENED_WITCH_POLICY;
  readonly day: number;
}
interface CollaborationBase extends BrewBase {
  readonly ordinal: 1 | 2 | 3;
}
export interface AwakenedWitchPayloadMap {
  awakened_brew_chosen: BrewBase & {
    readonly actorId: number;
    readonly mode: "heal" | "poison" | "pass";
    readonly targetId: number | null;
    readonly assistantIds: readonly number[];
    readonly ordinal: 1 | 2 | 3 | null;
  };
  brew_started: CollaborationBase & {
    readonly targetId: number;
    readonly assistantIds: readonly number[];
  };
  brew_discussion: CollaborationBase & { readonly actorId: number; readonly text: string };
  brew_approval: CollaborationBase & { readonly actorId: number; readonly approve: boolean };
  brew_resolved: CollaborationBase & {
    readonly actorId: number;
    readonly targetId: number;
    readonly assistantIds: readonly number[];
    readonly outcome: "poison" | "vetoed";
  };
}
export type AwakenedWitchEventType = keyof AwakenedWitchPayloadMap;
export type AwakenedWitchFact = {
  [K in AwakenedWitchEventType]: { readonly type: K; readonly payload: AwakenedWitchPayloadMap[K] };
}[AwakenedWitchEventType];
const eventTypes: readonly string[] = [
  "awakened_brew_chosen",
  "brew_started",
  "brew_discussion",
  "brew_approval",
  "brew_resolved",
];
export function isAwakenedWitchEventType(value: unknown): value is AwakenedWitchEventType {
  return typeof value === "string" && eventTypes.includes(value);
}
/** 严格复制事实，不从格式正确推导行动许可或多人一致性；后者由独立归档账本验证。 */
export function readAwakenedWitchFact(type: unknown, payload: unknown): AwakenedWitchFact | null {
  try {
    return readFact(type, payload);
  } catch {
    return null;
  }
}
function readFact(type: unknown, payload: unknown): AwakenedWitchFact | null {
  if (!isAwakenedWitchEventType(type)) return null;
  const p = copyEventData(payload, 16);
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const r = p as Record<string, unknown>;
  if (r.policy !== AWAKENED_WITCH_POLICY || !id(r.day)) return null;
  const ordinal = r.ordinal === 1 || r.ordinal === 2 || r.ordinal === 3;
  const assistants =
    Array.isArray(r.assistantIds) &&
    r.assistantIds.every(id) &&
    new Set(r.assistantIds).size === r.assistantIds.length &&
    r.assistantIds.length === r.ordinal;
  if (type === "awakened_brew_chosen") {
    if (
      !exact(r, ["policy", "day", "actorId", "mode", "targetId", "assistantIds", "ordinal"]) ||
      !id(r.actorId) ||
      !Array.isArray(r.assistantIds)
    )
      return null;
    if (
      (r.mode === "pass" &&
        r.targetId === null &&
        r.ordinal === null &&
        r.assistantIds.length === 0) ||
      (r.mode === "heal" &&
        id(r.targetId) &&
        r.targetId !== r.actorId &&
        r.ordinal === null &&
        r.assistantIds.length === 0) ||
      (r.mode === "poison" &&
        id(r.targetId) &&
        ordinal &&
        assistants &&
        !r.assistantIds.includes(r.actorId))
    )
      return { type, payload: r } as unknown as AwakenedWitchFact;
    return null;
  }
  if (!ordinal) return null;
  if (
    type === "brew_started" &&
    exact(r, ["policy", "day", "ordinal", "targetId", "assistantIds"]) &&
    id(r.targetId) &&
    assistants
  )
    return { type, payload: r } as unknown as AwakenedWitchFact;
  if (
    type === "brew_discussion" &&
    exact(r, ["policy", "day", "ordinal", "actorId", "text"]) &&
    id(r.actorId) &&
    typeof r.text === "string" &&
    r.text.length <= 8192
  )
    return { type, payload: r } as unknown as AwakenedWitchFact;
  if (
    type === "brew_approval" &&
    exact(r, ["policy", "day", "ordinal", "actorId", "approve"]) &&
    id(r.actorId) &&
    typeof r.approve === "boolean"
  )
    return { type, payload: r } as unknown as AwakenedWitchFact;
  if (
    type === "brew_resolved" &&
    exact(r, ["policy", "day", "ordinal", "actorId", "targetId", "assistantIds", "outcome"]) &&
    id(r.actorId) &&
    id(r.targetId) &&
    assistants &&
    Array.isArray(r.assistantIds) &&
    !r.assistantIds.includes(r.actorId) &&
    (r.outcome === "poison" || r.outcome === "vetoed")
  )
    return { type, payload: r } as unknown as AwakenedWitchFact;
  return null;
}
/** audience是历史知识边界：女巫选择只本人，交流只本次协助组，批准只本人，结果只God。 */
export function awakenedWitchFactAudience(
  type: AwakenedWitchEventType,
): "actor" | "assistants" | "god" {
  return type === "brew_resolved"
    ? "god"
    : type === "brew_started" || type === "brew_discussion"
      ? "assistants"
      : "actor";
}
