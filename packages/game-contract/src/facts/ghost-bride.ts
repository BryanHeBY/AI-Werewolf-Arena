/**
 * 负责鬼魂新娘婚礼、刀权捕获、工具及玩家关系知识的公共数据契约。
 * 输入为标识与已确认 inert 数据；输出为脱离结构／null，保持原字段、默认、限额及相关性。
 * 数据 owner 只构造序列化默认副本，不安装角色、持有 live 生命／回执或花费库存；
 * canKnife 是捕获时的知识布尔值，不是提交许可。浏览器反射不承诺 Proxy 零 trap，
 * Node 准入须先拒绝恶意对象，reader 不改变原阶段、资源或权限政策。
 */
import { copyEventData } from "../inert-event-data";
import type { Camp } from "../identity";

/** 唯一有来源的有限预设；扩展规则须有另一个具名政策，不从公共数据推导变体。 */
export const GHOST_BRIDE_POLICY = "awa_melbourne_ghost_bride_v1" as const;
export const GHOST_BRIDE_GOAL = "three_factions_elimination" as const;
export const GHOST_BRIDE_ROLE = "ghost_bride" as const;
/** 原可写成员知识联合；见证人没有伴侣聊天／库存字段，原 nullable 和 optional 保留。 */
export type WeddingActorView =
  | {
      policy: typeof GHOST_BRIDE_POLICY;
      member: "bride" | "groom";
      faction: Camp.ThirdParty;
      partnerId: number;
      witnessId: number | null;
      proposedWitnessId?: number;
      canKnife: boolean;
    }
  | {
      policy: typeof GHOST_BRIDE_POLICY;
      member: "witness";
      faction: Camp.ThirdParty;
      brideId: number;
      groomId: number;
      canKnife: boolean;
    };

export type WeddingStatus = "pending" | "active" | "paired" | "complete" | "failed" | "cancelled";
export interface GhostBrideState {
  policy: typeof GHOST_BRIDE_POLICY;
  remaining: 0 | 1;
  groomId: number | null;
}
export interface WeddingVote {
  actorId: number;
  targetId: number;
}
export interface WeddingSetup {
  policy: typeof GHOST_BRIDE_POLICY;
  status: WeddingStatus;
  actorId: number;
  groomId: number | null;
  witnessId: number | null;
  witnessVotes: WeddingVote[];
}
export interface WeddingPair {
  policy: typeof GHOST_BRIDE_POLICY;
  groupId: string;
  brideId: number;
  groomId: number;
  day: 1;
}
export interface WeddingGroup extends WeddingPair {
  witnessId: number;
}
export type WeddingKnifeOwner = "ordinary_pack" | "pair" | "witness" | "none";
export interface WeddingKnifeCapture {
  policy: typeof GHOST_BRIDE_POLICY;
  groupId: string;
  day: number;
  owner: WeddingKnifeOwner;
  actorIds: number[];
}
export type WeddingTool =
  | { name: "choose_bridegroom"; args: { target_id: number } }
  | { name: "choose_wedding_witness"; args: { target_id: number } }
  | { name: "speak_to_partner"; args: { text: string } }
  | { name: "wedding_kill_vote"; args: { target_id: number | null; abstain: boolean } }
  | { name: "kill_vote"; args: { target_id: number | null; abstain: boolean } };
function record(value: unknown): Record<string, unknown> | null {
  try {
    const p = copyEventData(value);
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
function exact(p: Record<string, unknown>, names: readonly string[]): boolean {
  return Object.keys(p).length === names.length && names.every((k) => Object.hasOwn(p, k));
}
function id(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}
function groupId(value: unknown): value is string {
  return typeof value === "string" && /^ghost-bride:1:[1-9][0-9]*$/.test(value);
}
export function freshGhostBrideState(): GhostBrideState {
  return { policy: GHOST_BRIDE_POLICY, remaining: 1, groomId: null };
}
export function readGhostBrideState(value: unknown): GhostBrideState | null {
  const p = record(value);
  return p &&
    exact(p, ["policy", "remaining", "groomId"]) &&
    p.policy === GHOST_BRIDE_POLICY &&
    (p.remaining === 0 || p.remaining === 1) &&
    (p.groomId === null || id(p.groomId)) &&
    (p.remaining === 0 || p.groomId === null)
    ? (p as unknown as GhostBrideState)
    : null;
}
export function readWeddingPair(value: unknown): WeddingPair | null {
  const p = record(value);
  return p &&
    exact(p, ["policy", "groupId", "brideId", "groomId", "day"]) &&
    p.policy === GHOST_BRIDE_POLICY &&
    groupId(p.groupId) &&
    p.day === 1 &&
    id(p.brideId) &&
    id(p.groomId) &&
    p.brideId !== p.groomId &&
    p.groupId === `ghost-bride:1:${p.brideId}`
    ? (p as unknown as WeddingPair)
    : null;
}
export function readWeddingGroup(value: unknown): WeddingGroup | null {
  const p = record(value);
  if (!p || !exact(p, ["policy", "groupId", "brideId", "groomId", "day", "witnessId"])) return null;
  const { witnessId, ...pair } = p;
  return readWeddingPair(pair) &&
    id(witnessId) &&
    witnessId !== p.brideId &&
    witnessId !== p.groomId
    ? (p as unknown as WeddingGroup)
    : null;
}
export function readWeddingSetup(value: unknown): WeddingSetup | null {
  const p = record(value);
  if (
    !p ||
    !exact(p, ["policy", "status", "actorId", "groomId", "witnessId", "witnessVotes"]) ||
    p.policy !== GHOST_BRIDE_POLICY ||
    !id(p.actorId) ||
    !["pending", "active", "paired", "complete", "failed", "cancelled"].includes(
      p.status as string,
    ) ||
    (p.groomId !== null && (!id(p.groomId) || p.groomId === p.actorId)) ||
    (p.witnessId !== null &&
      (!id(p.witnessId) || p.witnessId === p.actorId || p.witnessId === p.groomId)) ||
    !Array.isArray(p.witnessVotes) ||
    p.witnessVotes.length > 2
  )
    return null;
  const votes = p.witnessVotes as unknown[];
  if (
    !votes.every((v, i) => {
      const a = record(v);
      return (
        a &&
        exact(a, ["actorId", "targetId"]) &&
        a.actorId === (i === 0 ? p.actorId : p.groomId) &&
        id(a.targetId) &&
        a.targetId !== p.actorId &&
        a.targetId !== p.groomId
      );
    })
  )
    return null;
  if (p.status === "pending" || p.status === "active") {
    if (p.groomId !== null || p.witnessId !== null || votes.length !== 0) return null;
  } else if (p.status === "complete") {
    if (
      p.groomId === null ||
      p.witnessId === null ||
      votes.length !== 2 ||
      !(votes as WeddingVote[]).every((v) => v.targetId === p.witnessId)
    )
      return null;
  } else {
    if (
      p.witnessId !== null ||
      (p.groomId === null && votes.length > 0) ||
      (p.status === "paired" && (p.groomId === null || votes.length > 1)) ||
      (votes.length === 2 &&
        (votes[0] as WeddingVote).targetId === (votes[1] as WeddingVote).targetId)
    )
      return null;
  }
  return p as unknown as WeddingSetup;
}
export function readWeddingKnifeCapture(value: unknown): WeddingKnifeCapture | null {
  const p = record(value);
  if (
    !p ||
    !exact(p, ["policy", "groupId", "day", "owner", "actorIds"]) ||
    p.policy !== GHOST_BRIDE_POLICY ||
    !groupId(p.groupId) ||
    !id(p.day) ||
    !["ordinary_pack", "pair", "witness", "none"].includes(p.owner as string) ||
    !Array.isArray(p.actorIds) ||
    !p.actorIds.every(id) ||
    new Set(p.actorIds).size !== p.actorIds.length
  )
    return null;
  const n = p.actorIds.length;
  return (
    p.owner === "none"
      ? n === 0
      : p.owner === "pair"
        ? n === 2
        : p.owner === "witness"
          ? n === 1
          : n >= 1 && n <= 3
  )
    ? (p as unknown as WeddingKnifeCapture)
    : null;
}
export function readWeddingTool(value: unknown): WeddingTool | null {
  const p = record(value),
    a = record(p?.args);
  if (!p || !exact(p, ["name", "args"]) || !a) return null;
  if (p.name === "choose_bridegroom" || p.name === "choose_wedding_witness")
    return exact(a, ["target_id"]) && id(a.target_id) ? (p as unknown as WeddingTool) : null;
  if (p.name === "speak_to_partner")
    return exact(a, ["text"]) && typeof a.text === "string" ? (p as unknown as WeddingTool) : null;
  if (p.name === "wedding_kill_vote" || p.name === "kill_vote")
    return exact(a, ["target_id", "abstain"]) &&
      ((a.abstain === true && a.target_id === null) || (a.abstain === false && id(a.target_id)))
      ? (p as unknown as WeddingTool)
      : null;
  return null;
}

export const GHOST_BRIDE_EVENT_TYPES = [
  "ghost_bride_pair_chosen",
  "ghost_bride_witness_vote",
  "ghost_bride_group_chosen",
  "ghost_bride_partner_chat",
  "ghost_bride_knife_captured",
  "ghost_bride_knife_vote",
  "ghost_bride_knife_resolved",
  "ghost_bride_partner_death",
] as const;
export function readGhostBrideEventFact(
  type: string,
  value: unknown,
): Record<string, unknown> | null {
  const p = record(value);
  if (!p || p.policy !== GHOST_BRIDE_POLICY || !groupId(p.groupId)) return null;
  if (type === "ghost_bride_pair_chosen") return readWeddingPair(p) ? p : null;
  if (type === "ghost_bride_group_chosen") return readWeddingGroup(p) ? p : null;
  if (type === "ghost_bride_knife_captured") return readWeddingKnifeCapture(p) ? p : null;
  if (type === "ghost_bride_witness_vote")
    return exact(p, ["policy", "groupId", "day", "actorId", "targetId", "voteIndex"]) &&
      p.day === 1 &&
      id(p.actorId) &&
      id(p.targetId) &&
      p.actorId !== p.targetId &&
      (p.voteIndex === 1 || p.voteIndex === 2)
      ? p
      : null;
  if (type === "ghost_bride_partner_chat")
    return exact(p, ["policy", "groupId", "day", "actorId", "recipientId", "text"]) &&
      id(p.day) &&
      id(p.actorId) &&
      id(p.recipientId) &&
      p.actorId !== p.recipientId &&
      typeof p.text === "string"
      ? p
      : null;
  if (type === "ghost_bride_knife_vote")
    return exact(p, ["policy", "groupId", "day", "owner", "actorId", "targetId", "abstain"]) &&
      id(p.day) &&
      id(p.actorId) &&
      ["ordinary_pack", "pair", "witness"].includes(p.owner as string) &&
      ((p.targetId === null && p.abstain === true) || (id(p.targetId) && p.abstain === false))
      ? p
      : null;
  if (type === "ghost_bride_knife_resolved") {
    const { targetId, ...capture } = p;
    return readWeddingKnifeCapture(capture) && (targetId === null || id(targetId)) ? p : null;
  }
  if (type === "ghost_bride_partner_death")
    return exact(p, ["policy", "groupId", "day", "actorId", "targetId", "phase"]) &&
      id(p.day) &&
      id(p.actorId) &&
      id(p.targetId) &&
      p.actorId !== p.targetId &&
      ["night", "day", "voting"].includes(p.phase as string)
      ? p
      : null;
  return null;
}
