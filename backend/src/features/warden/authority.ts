/**
 * 负责典狱长真实pair与双方独立决定的原体授权。输入为原World、日次和已校验候选，
 * 输出单次付款及本夜效果；唯一窗口持真实原生命，不复制历史库存，不从DTO恢复许可。
 * pair先消耗两人的全局参与资格，决定失败保留已付pair及已接受回执；施者付款后撤换不回收效果。
 * 不变量：始终只在原actor／双方原体及原slot仍有效时提交；付款提交写入唯一槽，窗口关闭不退款。
 */
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import type { WardenDecision, WardenState } from "@ai-werewolf-arena/game-contract/facts/warden";
import type { World } from "../../domain/world";
import {
  captureOriginalPlayer,
  originalPlayerAtCommit,
  originalPlayerCurrent,
  originalPlayerSameLife,
  type OriginalPlayerScope,
} from "../../domain/original-player-scope";
import { getWardenState, prepareWardenHistory, replaceWardenState } from "./state";
/** 运行窗口只持原体、实际状态引用和不可逆撤权墓碑；used资格始终从唯一history读取。 */
interface Window {
  actor: OriginalPlayerScope;
  container: object;
  state: WardenState;
  day: number;
  selecting: boolean;
  closed: boolean;
  slotRevoked: boolean;
  actorRevoked: boolean;
  revokedTargets: Set<OriginalPlayerScope>;
  targets: Map<number, OriginalPlayerScope>;
  pair: readonly [OriginalPlayerScope, OriginalPlayerScope] | null;
}
const windows = new WeakMap<World, Window>();
function slotCurrent(w: Window): boolean {
  if (w.slotRevoked) return false;
  const current =
    Object.getOwnPropertyDescriptor(w.actor.role, "privateState")?.value === w.container &&
    getWardenState(w.actor.role) === w.state;
  if (!current) w.slotRevoked = true;
  return current;
}
function actorCurrent(world: World, w: Window): boolean {
  if (w.actorRevoked) return false;
  const current = originalPlayerCurrent(world, w.actor);
  if (!current) w.actorRevoked = true;
  return current;
}
/** 已观察到换体即永久撤权；恢复旧引用不能使旧交易效果或请求重新生效。 */
function targetCurrent(
  world: World,
  w: Window,
  s: OriginalPlayerScope,
  firstDeath = false,
): boolean {
  if (w.revokedTargets.has(s)) return false;
  const current = originalPlayerSameLife(world, s, firstDeath);
  if (!current) w.revokedTargets.add(s);
  return current;
}
/** 付款末端只读真实存储；可重入World查询不能在检查另一方时偷换已检查的原体。 */
function targetAtCommit(world: World, w: Window, s: OriginalPlayerScope): boolean {
  if (w.revokedTargets.has(s)) return false;
  const current = originalPlayerAtCommit(world, s);
  if (!current) w.revokedTargets.add(s);
  return current;
}
function selecting(world: World, w: Window): boolean {
  return w.selecting && !w.closed && slotCurrent(w) && actorCurrent(world, w);
}
function pairCurrent(world: World, w: Window): boolean {
  return !!w.pair && !w.closed && w.pair.every((s) => targetCurrent(world, w, s));
}
export function openWardenNight(world: World, actorId: number, day: number): void {
  const prev = windows.get(world);
  if (
    prev &&
    (!prev.closed ||
      prev.day >= day ||
      prev.actor.id !== actorId ||
      !actorCurrent(world, prev) ||
      !slotCurrent(prev))
  )
    throw new Error("warden_night_unavailable");
  const actor = captureOriginalPlayer(world, actorId),
    state = getWardenState(actor?.role);
  if (
    day < 2 ||
    !actor ||
    actor.roleId !== Role.Warden ||
    actor.campValue !== Camp.Wolf ||
    !state ||
    (state.history.at(-1)?.day ?? 1) >= day
  )
    throw new Error("warden_night_unavailable");
  const used = new Set(state.history.flatMap((r) => r.pair ?? [])),
    targets = new Map<number, OriginalPlayerScope>();
  for (const id of world.getAliveEntityIds()) {
    if (used.has(id)) continue;
    const p = captureOriginalPlayer(world, id);
    if (!p) throw new Error("warden_roster_stale");
    targets.set(id, p);
  }
  windows.set(world, {
    actor,
    state,
    container: Object.getOwnPropertyDescriptor(actor.role, "privateState")!.value,
    day,
    selecting: true,
    closed: false,
    slotRevoked: false,
    actorRevoked: false,
    revokedTargets: new Set(),
    targets,
    pair: null,
  });
}
export function wardenNightCurrent(world: World, actorId: number, day: number): boolean {
  const w = windows.get(world);
  return !!w && w.actor.id === actorId && w.day === day && selecting(world, w);
}
export function wardenCandidates(world: World, actorId: number, day: number): number[] {
  const w = windows.get(world);
  return w && w.actor.id === actorId && w.day === day && selecting(world, w)
    ? [...w.targets].filter(([, s]) => targetCurrent(world, w, s)).map(([id]) => id)
    : [];
}
export function wardenPairAllowed(
  world: World,
  actorId: number,
  day: number,
  pair: readonly [number, number] | null,
): boolean {
  const w = windows.get(world);
  if (!w || w.actor.id !== actorId || w.day !== day || !selecting(world, w)) return false;
  return (
    pair === null ||
    (pair.length === 2 &&
      pair[0] !== pair[1] &&
      pair.every((id) => {
        const p = w.targets.get(id);
        return !!p && targetCurrent(world, w, p);
      }))
  );
}
export function commitWardenPair(
  world: World,
  actorId: number,
  day: number,
  pair: readonly [number, number] | null,
  beforeWrite: () => boolean,
): void {
  if (!wardenPairAllowed(world, actorId, day, pair)) throw new Error("warden_pair_invalid");
  const w = windows.get(world)!,
    expected = w.state,
    scopes = pair ? ([w.targets.get(pair[0])!, w.targets.get(pair[1])!] as const) : null;
  const next = prepareWardenHistory([
    ...expected.history,
    { day, pair: pair ? [pair[0], pair[1]] : null, decisions: [], resolved: pair === null },
  ]);
  if (
    !beforeWrite() ||
    !selecting(world, w) ||
    (scopes && !scopes.every((s) => targetCurrent(world, w, s)))
  )
    throw new Error("warden_pair_revoked");
  if (
    windows.get(world) !== w ||
    w.state !== expected ||
    !originalPlayerAtCommit(world, w.actor) ||
    (scopes && !scopes.every((s) => targetAtCommit(world, w, s))) ||
    !slotCurrent(w)
  )
    throw new Error("warden_pair_revoked");
  replaceWardenState(w.actor.role, expected, next);
  w.state = next;
  w.pair = scopes;
  w.selecting = false;
}
export function wardenDecisionCurrent(world: World, actorId: number, day: number): boolean {
  const w = windows.get(world),
    r = w?.state.history.at(-1);
  return (
    !!w &&
    w.day === day &&
    !w.selecting &&
    pairCurrent(world, w) &&
    slotCurrent(w) &&
    !!r &&
    !r.decisions.some((d) => d.playerId === actorId) &&
    !!w.pair?.some((p) => p.id === actorId)
  );
}
export function wardenPartner(world: World, actorId: number, day: number): number | null {
  const w = windows.get(world);
  return wardenDecisionCurrent(world, actorId, day)
    ? w!.pair!.find((p) => p.id !== actorId)!.id
    : null;
}
export function commitWardenDecision(
  world: World,
  actorId: number,
  day: number,
  choice: WardenDecision,
  beforeWrite: () => boolean,
): void {
  if (!wardenDecisionCurrent(world, actorId, day) || (choice !== "trade" && choice !== "betray"))
    throw new Error("warden_decision_invalid");
  const w = windows.get(world)!,
    expected = w.state,
    r = expected.history.at(-1)!;
  const decisions = [...r.decisions, { playerId: actorId, choice }];
  const next = prepareWardenHistory([
    ...expected.history.slice(0, -1),
    { ...r, decisions, resolved: decisions.length === 2 },
  ]);
  if (!beforeWrite() || w.state !== expected || !wardenDecisionCurrent(world, actorId, day))
    throw new Error("warden_decision_revoked");
  if (
    windows.get(world) !== w ||
    w.state !== expected ||
    !w.pair?.every((s) => targetAtCommit(world, w, s)) ||
    !slotCurrent(w)
  )
    throw new Error("warden_decision_revoked");
  // 已付pair的原角色对象继续保存God因果，不因施者换席/身份而向替换容器迁移。
  replaceWardenState(w.actor.role, expected, next);
  w.state = next;
}
export function closeWardenNight(world: World): void {
  const w = windows.get(world);
  if (w) {
    w.closed = true;
    w.selecting = false;
  }
}
export interface WardenOutcome {
  readonly actorId: number;
  readonly pair: readonly [number, number];
  readonly choices: readonly [WardenDecision, WardenDecision];
  readonly outcome: "protect" | "force" | "deal";
  readonly dealIds: readonly number[];
}
/** 解析已付真值表只读同一receipt；死亡/换体目标不把效果交给同座替身，施者已付撤换不撤销。 */
function paidOutcome(w: Window): WardenOutcome | null {
  const r = w.state.history.at(-1);
  if (!w.pair || !r?.resolved || !r.pair) return null;
  const a = r.decisions.find((d) => d.playerId === r.pair![0])!.choice,
    b = r.decisions.find((d) => d.playerId === r.pair![1])!.choice;
  if (r.pair.includes(w.actor.id)) {
    const other = r.pair.find((id) => id !== w.actor.id)!;
    return {
      actorId: w.actor.id,
      pair: r.pair,
      choices: [a, b],
      outcome: "deal",
      dealIds: [a === b ? w.actor.id : other],
    };
  }
  return {
    actorId: w.actor.id,
    pair: r.pair,
    choices: [a, b],
    outcome: a === b ? (a === "trade" ? "protect" : "force") : "deal",
    dealIds: a === b ? [] : [a === "trade" ? r.pair[0] : r.pair[1]],
  };
}
export function wardenOutcome(world: World, day: number): WardenOutcome | null {
  const w = windows.get(world);
  return w && w.day === day && slotCurrent(w) ? paidOutcome(w) : null;
}
export function wardenEffectScopes(
  world: World,
  day: number,
  kind: "protect" | "deal",
): readonly OriginalPlayerScope[] {
  const w = windows.get(world),
    o = wardenOutcome(world, day);
  if (!w?.pair || !o || o.outcome !== kind) return [];
  return w.pair.filter(
    (s) => (kind === "protect" || o.dealIds.includes(s.id)) && targetCurrent(world, w, s, true),
  );
}
export function forcedWardenPartner(
  world: World,
  day: number,
  actorId: number,
): { targetId: number; isCurrent: () => boolean } | null {
  const w = windows.get(world),
    o = w && w.day === day ? paidOutcome(w) : null;
  if (!w?.pair || o?.outcome !== "force" || !o.pair.includes(actorId)) return null;
  const actor = w.pair.find((s) => s.id === actorId)!,
    target = w.pair.find((s) => s.id !== actorId)!;
  return {
    targetId: target.id,
    isCurrent: () =>
      windows.get(world) !== w || wardenOutcome(world, day) === null
        ? false
        : targetCurrent(world, w, actor) && targetCurrent(world, w, target),
  };
}
