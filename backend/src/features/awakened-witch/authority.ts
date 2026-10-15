/**
 * 负责觉醒女巫的原体夜窗、三轮协作付款与秘密回执。输入是原World、日次和显式行动，
 * 输出唯一历史槽的同步替换；资源和已参与者只从该历史推导，不从请求或归档恢复权限。
 * 不变量：仅原窗口可提交历史，发起先付次数与协助资格，讨论及各批准分别付款；任何后续失败保留前缀，不补默认否决。
 * Poison最后独立提交，已付后允许原施者首次死亡，不能伤替换生命或借复活恢复窗口。
 */
import { Camp } from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_WITCH_ROLE_ID,
  awakenedWitchResources,
  type AwakenedWitchNight,
  type AwakenedWitchState,
} from "@ai-werewolf-arena/game-contract/facts/awakened-witch";
import type { World } from "../../domain/world";
import {
  captureOriginalPlayer,
  originalPlayerCurrent,
  originalPlayerSameLife,
  originalPlayerAtCommit,
  type OriginalPlayerScope,
} from "../../domain/original-player-scope";
import {
  getAwakenedWitchState,
  prepareAwakenedWitchState,
  replaceAwakenedWitchState,
} from "./state";

type BrewNight = Extract<AwakenedWitchNight, { mode: "poison" }>;
export interface AwakenedBrewChoice {
  readonly mode: "heal" | "poison" | "pass";
  readonly targetId: number | null;
  readonly assistantIds: readonly number[];
}
interface Window {
  readonly actor: OriginalPlayerScope;
  readonly container: object;
  state: AwakenedWitchState;
  readonly day: number;
  readonly knifeId: number | null;
  readonly roster: Map<number, OriginalPlayerScope>;
  selecting: boolean;
  closed: boolean;
  slotRevoked: boolean;
  actorRevoked: boolean;
  paidSourceRevoked: boolean;
  readonly revokedTargets: Set<OriginalPlayerScope>;
  target: OriginalPlayerScope | null;
  assistants: readonly OriginalPlayerScope[];
}
const windows = new WeakMap<World, Window>();
function slotCurrent(w: Window): boolean {
  if (w.slotRevoked) return false;
  const current =
    Object.getOwnPropertyDescriptor(w.actor.role, "privateState")?.value === w.container &&
    getAwakenedWitchState(w.actor.role) === w.state;
  if (!current) w.slotRevoked = true;
  return current;
}
/** 撤权标记属于内存能力，不是资源镜像；已经观察到的换体/换槽不能靠恢复旧引用重获权限。 */
function actorCurrent(world: World, w: Window): boolean {
  if (w.actorRevoked) return false;
  const current = originalPlayerCurrent(world, w.actor);
  if (!current) w.actorRevoked = true;
  return current;
}
function targetCurrent(world: World, w: Window, s: OriginalPlayerScope): boolean {
  if (w.revokedTargets.has(s)) return false;
  const current = originalPlayerCurrent(world, s);
  if (!current) w.revokedTargets.add(s);
  return current;
}
function paidSourceCurrent(world: World, w: Window): boolean {
  if (w.paidSourceRevoked) return false;
  const current = originalPlayerSameLife(world, w.actor, true);
  if (!current) w.paidSourceRevoked = true;
  return current;
}
function selecting(world: World, w: Window): boolean {
  return !w.closed && w.selecting && slotCurrent(w) && actorCurrent(world, w);
}
function collaboration(world: World, w: Window): BrewNight | null {
  const row = w.state.nights.at(-1);
  return !w.closed &&
    !w.selecting &&
    row?.mode === "poison" &&
    row.outcome === "building" &&
    slotCurrent(w) &&
    actorCurrent(world, w) &&
    w.target &&
    targetCurrent(world, w, w.target) &&
    w.assistants.every((p) => targetCurrent(world, w, p))
    ? row
    : null;
}
/** 新夜只接续同一原角色完整结束的历史；失败的半成品不能在下一夜被伪装成正常否决。 */
export function openAwakenedWitchNight(
  world: World,
  actorId: number,
  day: number,
  knifeId: number | null,
): void {
  const prev = windows.get(world);
  if (
    prev &&
    (!prev.closed ||
      prev.day >= day ||
      prev.actor.id !== actorId ||
      !slotCurrent(prev) ||
      !actorCurrent(world, prev))
  )
    throw new Error("awakened_witch_night_unavailable");
  const actor = captureOriginalPlayer(world, actorId),
    state = getAwakenedWitchState(actor?.role);
  if (
    !Number.isSafeInteger(day) ||
    day < 1 ||
    !actor ||
    actor.roleId !== AWAKENED_WITCH_ROLE_ID ||
    actor.campValue !== Camp.Good ||
    !state ||
    (state.nights.at(-1)?.day ?? 0) >= day ||
    (state.nights.at(-1)?.mode === "poison" &&
      (state.nights.at(-1) as BrewNight).outcome === "building")
  )
    throw new Error("awakened_witch_night_unavailable");
  const roster = new Map<number, OriginalPlayerScope>();
  for (const id of world.getAliveEntityIds()) {
    const p = captureOriginalPlayer(world, id);
    if (!p) throw new Error("awakened_witch_roster_stale");
    roster.set(id, p);
  }
  windows.set(world, {
    actor,
    state,
    container: Object.getOwnPropertyDescriptor(actor.role, "privateState")!.value,
    day,
    knifeId,
    roster,
    selecting: true,
    closed: false,
    slotRevoked: false,
    actorRevoked: false,
    paidSourceRevoked: false,
    revokedTargets: new Set(),
    target: null,
    assistants: [],
  });
}
export function awakenedWitchNightCurrent(world: World, actorId: number, day: number): boolean {
  const w = windows.get(world);
  return !!w && w.actor.id === actorId && w.day === day && selecting(world, w);
}
export function awakenedWitchOptions(world: World, actorId: number, day: number) {
  const w = windows.get(world);
  if (!w || w.actor.id !== actorId || w.day !== day || !selecting(world, w)) return null;
  const resources = awakenedWitchResources(w.state),
    used = new Set(resources.usedAssistantIds),
    targets = [...w.roster].filter(([, p]) => targetCurrent(world, w, p)).map(([id]) => id),
    assistants = targets.filter((id) => id !== actorId && !used.has(id)),
    required = 4 - resources.brewRemaining;
  return {
    ...resources,
    targetIds: targets,
    assistantIds: assistants,
    requiredAssistants: required,
    canPoison: resources.brewRemaining > 0 && assistants.length >= required,
    // 只有持解药时暴露基础刀口；其它死因不进入本人选项。
    wolfTarget: resources.healRemaining ? w.knifeId : undefined,
    canHeal:
      !!resources.healRemaining &&
      w.knifeId !== null &&
      w.knifeId !== actorId &&
      targets.includes(w.knifeId),
  };
}
export function awakenedBrewAllowed(
  world: World,
  actorId: number,
  day: number,
  choice: AwakenedBrewChoice,
): boolean {
  const options = awakenedWitchOptions(world, actorId, day);
  if (!options || !Array.isArray(choice.assistantIds)) return false;
  if (choice.mode === "pass") return choice.targetId === null && choice.assistantIds.length === 0;
  if (choice.mode === "heal")
    return (
      options.canHeal && choice.targetId === options.wolfTarget && choice.assistantIds.length === 0
    );
  return (
    choice.mode === "poison" &&
    options.canPoison &&
    choice.targetId !== null &&
    options.targetIds.includes(choice.targetId) &&
    choice.assistantIds.length === options.requiredAssistants &&
    new Set(choice.assistantIds).size === choice.assistantIds.length &&
    choice.assistantIds.every((id) => options.assistantIds.includes(id))
  );
}
export function commitAwakenedBrew(
  world: World,
  actorId: number,
  day: number,
  choice: AwakenedBrewChoice,
  beforeWrite: () => boolean,
): AwakenedWitchNight {
  if (!awakenedBrewAllowed(world, actorId, day, choice)) throw new Error("awakened_brew_invalid");
  const w = windows.get(world)!,
    options = awakenedWitchOptions(world, actorId, day)!;
  const assistantIds = [...choice.assistantIds].sort((a, b) => a - b),
    target = choice.targetId === null ? null : w.roster.get(choice.targetId)!,
    assistants = assistantIds.map((id) => w.roster.get(id)!);
  const row: AwakenedWitchNight =
    choice.mode === "pass"
      ? { day, mode: "pass" }
      : choice.mode === "heal"
        ? { day, mode: "heal", targetId: choice.targetId! }
        : {
            day,
            mode: "poison",
            targetId: choice.targetId!,
            ordinal: options.requiredAssistants as 1 | 2 | 3,
            assistantIds,
            discussions: [],
            approvals: [],
            outcome: "building",
          };
  const next = prepareAwakenedWitchState([...w.state.nights, row]);
  // 构造所有惰性值后最后检查运行租约及每个原体，第一语义写只有自己的状态槽。
  if (
    !beforeWrite() ||
    !selecting(world, w) ||
    (target && !targetCurrent(world, w, target)) ||
    !assistants.every((p) => targetCurrent(world, w, p))
  )
    throw new Error("awakened_brew_revoked");
  if (
    !originalPlayerAtCommit(world, w.actor) ||
    (target && !originalPlayerAtCommit(world, target)) ||
    !assistants.every((p) => originalPlayerAtCommit(world, p))
  )
    throw new Error("awakened_brew_revoked");
  replaceAwakenedWitchState(w.actor.role, w.state, next);
  w.state = next;
  w.target = target;
  w.assistants = Object.freeze(assistants);
  w.selecting = false;
  return next.nights.at(-1)!;
}
export function awakenedBrewDiscussionCurrent(world: World, actorId: number, day: number): boolean {
  const w = windows.get(world),
    row = w && w.day === day ? collaboration(world, w) : null;
  return !!row && row.assistantIds[row.discussions.length] === actorId;
}
export function awakenedBrewApprovalCurrent(world: World, actorId: number, day: number): boolean {
  const w = windows.get(world),
    row = w && w.day === day ? collaboration(world, w) : null;
  return (
    !!row &&
    row.discussions.length === row.assistantIds.length &&
    row.assistantIds.includes(actorId) &&
    !row.approvals.some((a) => a.actorId === actorId)
  );
}
function replaceBrew(world: World, w: Window, row: BrewNight, beforeWrite: () => boolean): void {
  const expected = w.state,
    next = prepareAwakenedWitchState([...expected.nights.slice(0, -1), row]);
  if (!beforeWrite() || w.state !== expected || !collaboration(world, w))
    throw new Error("awakened_brew_revoked");
  if (
    !originalPlayerAtCommit(world, w.actor) ||
    !w.target ||
    !originalPlayerAtCommit(world, w.target) ||
    !w.assistants.every((p) => originalPlayerAtCommit(world, p))
  )
    throw new Error("awakened_brew_revoked");
  replaceAwakenedWitchState(w.actor.role, expected, next);
  w.state = next;
}
export function commitBrewDiscussion(
  world: World,
  actorId: number,
  day: number,
  text: string,
  beforeWrite: () => boolean,
): void {
  if (
    !awakenedBrewDiscussionCurrent(world, actorId, day) ||
    typeof text !== "string" ||
    text.length > 8192
  )
    throw new Error("awakened_brew_discussion_invalid");
  const w = windows.get(world)!,
    row = collaboration(world, w)!;
  replaceBrew(
    world,
    w,
    { ...row, discussions: [...row.discussions, { actorId, text }] },
    () => beforeWrite() && awakenedBrewDiscussionCurrent(world, actorId, day),
  );
}
export function commitBrewApproval(
  world: World,
  actorId: number,
  day: number,
  approve: boolean,
  beforeWrite: () => boolean,
): void {
  if (!awakenedBrewApprovalCurrent(world, actorId, day) || typeof approve !== "boolean")
    throw new Error("awakened_brew_approval_invalid");
  const w = windows.get(world)!,
    row = collaboration(world, w)!;
  replaceBrew(
    world,
    w,
    { ...row, approvals: [...row.approvals, { actorId, approve }] },
    () => beforeWrite() && awakenedBrewApprovalCurrent(world, actorId, day),
  );
}
/** 调度只取得本次固定名单与目标；不提供女巫座位、其他批准票或全体完成状态给请求DTO。 */
export function awakenedBrewParticipants(world: World, day: number) {
  const w = windows.get(world),
    row = w && w.day === day ? collaboration(world, w) : null;
  return row
    ? { ordinal: row.ordinal, targetId: row.targetId, assistantIds: [...row.assistantIds] }
    : null;
}
export function finalizeAwakenedBrew(
  world: World,
  day: number,
  beforeWrite: () => boolean,
): "poison" | "vetoed" {
  const w = windows.get(world),
    row = w && w.day === day ? collaboration(world, w) : null;
  if (!w || !row || row.approvals.length !== row.assistantIds.length)
    throw new Error("awakened_brew_incomplete");
  const outcome = row.approvals.every((a) => a.approve) ? "poison" : "vetoed";
  replaceBrew(world, w, { ...row, outcome }, beforeWrite);
  return outcome;
}
/** 同一窗口句柄产生的已付Poison有效性，不要求协助者随后存活，也不因关闭请求而撤毒。 */
export function prepareAwakenedBrewPoisonScope(world: World, day: number) {
  const w = windows.get(world),
    row = w?.state.nights.at(-1);
  if (!w || w.day !== day || row?.mode !== "poison" || !w.target) return null;
  const target = w.target;
  return {
    actor: w.actor,
    target,
    isCurrent: () =>
      windows.get(world) === w &&
      slotCurrent(w) &&
      w.state.nights.at(-1)?.mode === "poison" &&
      (w.state.nights.at(-1) as BrewNight).outcome === "poison" &&
      paidSourceCurrent(world, w) &&
      targetCurrent(world, w, target),
  };
}
export function closeAwakenedWitchNight(world: World): void {
  const w = windows.get(world);
  if (w) {
    w.closed = true;
    w.selecting = false;
  }
}

/** 解药是普通Heal而非全伤免疫；此句柄只证明已经支付及原目标，印记仍由伤害owner消费。 */
export function awakenedWitchPaidHealScope(world: World, day: number) {
  const w = windows.get(world),
    row = w?.state.nights.at(-1);
  if (!w || w.day !== day || row?.mode !== "heal" || !w.target) return null;
  const target = w.target;
  return {
    target,
    isCurrent: () =>
      windows.get(world) === w &&
      slotCurrent(w) &&
      w.state.nights.at(-1)?.mode === "heal" &&
      paidSourceCurrent(world, w) &&
      targetCurrent(world, w, target),
  };
}
