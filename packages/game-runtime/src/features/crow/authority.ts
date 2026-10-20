/**
 * 负责乌鸦真实夜窗与已付诅咒绑定，唯一拥有窗口、候选原生命和票轮去重状态。
 * 输入为原World、行动者、日期及已校验选择；输出为合法选择提交和独立附加票事实。
 * 提交必须先验原身份/生命/状态；首次死亡保留已付效果，复活或替换撤权，未付关闭不能重交。
 * 写入按历史付款、目标绑定、关闭顺序完成，后续失败保留已写前缀，不退库存或迁移到同号新生命。
 */
import { Camp, Role, type CrowState, type GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../domain/world";
import { COMPONENT } from "../../domain/components/names";
import {
  captureOriginalPlayer,
  originalPlayerCurrent,
  originalPlayerSameLife,
  type OriginalPlayerScope,
} from "../../domain/original-player-scope";
import { canBeExiled } from "../../engine/participation";
import { crowState, commitCrowState } from "./state";
/** 一局最多一份真实夜窗；targets在提示发布前捕获，target仅在付款后绑定。
 * pending=false既可能已提交，也可能未付关闭，是否生效仍须有target和同一日次。
 * expected只核原状态没有被替换/篡改，不是第二份库存；applied只对当日真实票轮去重。 */
interface Window {
  actor: OriginalPlayerScope;
  state: CrowState;
  container: object;
  day: number;
  expected: string;
  pending: boolean;
  target: OriginalPlayerScope | null;
  targets: Map<number, OriginalPlayerScope>;
  applied: Set<number>;
}
// 这里只持实际窗口与已付目标，不复制私态库存；后续白天使用同一份已付绑定。
const windows = new WeakMap<World, Window>();
function current(world: World, w: Window): boolean {
  return (
    originalPlayerCurrent(world, w.actor) &&
    w.actor.role.privateState === w.container &&
    crowState(w.actor.role) === w.state &&
    JSON.stringify(w.state) === w.expected
  );
}
export function crowCandidates(world: World, actorId: number, day: number): number[] {
  const s = crowState(world.getComponent(actorId, COMPONENT.Role));
  if (!s) return [];
  const last = s.history.at(-1);
  return world
    .getAliveEntityIds()
    .filter(
      (id) => (s.selfTarget || id !== actorId) && !(last?.day === day - 1 && last.targetId === id),
    );
}
export function openCrowNight(world: World, actorId: number, day: number): void {
  const previous = windows.get(world);
  // 关闭留下同日墓碑；下一夜仍须是同一原角色/生命，不能用新窗口掩盖复活或替身。
  if (
    previous &&
    (previous.actor.id !== actorId ||
      previous.pending ||
      previous.day >= day ||
      !originalPlayerSameLife(world, previous.actor, true) ||
      previous.actor.role.privateState !== previous.container ||
      crowState(previous.actor.role) !== previous.state ||
      JSON.stringify(previous.state) !== previous.expected)
  )
    throw new Error("crow_night_unavailable");
  const actor = captureOriginalPlayer(world, actorId),
    state = crowState(actor?.role);
  if (
    !actor ||
    actor.roleId !== Role.Crow ||
    actor.campValue !== Camp.Good ||
    !state ||
    (state.history.at(-1)?.day ?? 0) >= day
  )
    throw new Error("crow_night_unavailable");
  const targets = new Map<number, OriginalPlayerScope>();
  for (const id of crowCandidates(world, actorId, day)) {
    const target = captureOriginalPlayer(world, id);
    if (!target) throw new Error("crow_roster_stale");
    targets.set(id, target);
  }
  windows.set(world, {
    targets,
    actor,
    state,
    container: actor.role.privateState,
    day,
    expected: JSON.stringify(state),
    pending: true,
    target: null,
    applied: new Set(),
  });
}
export function crowChoiceAllowed(
  world: World,
  actorId: number,
  day: number,
  targetId: number | null,
): boolean {
  const w = windows.get(world);
  if (!w || !w.pending || w.actor.id !== actorId || w.day !== day || !current(world, w))
    return false;
  const targets = crowCandidates(world, actorId, day);
  return targetId === null
    ? w.state.actionPolicy === "optional" || targets.length === 0
    : targets.includes(targetId) &&
        !!w.targets.get(targetId) &&
        originalPlayerCurrent(world, w.targets.get(targetId)!);
}
export function assertCrowCurrent(world: World, actorId: number, day: number): void {
  const w = windows.get(world);
  if (!w || !w.pending || w.actor.id !== actorId || w.day !== day || !current(world, w))
    throw new Error("crow_night_stale");
}
export function commitCrowChoice(
  world: World,
  actorId: number,
  day: number,
  targetId: number | null,
  beforeWrite: () => boolean = () => true,
): void {
  if (!crowChoiceAllowed(world, actorId, day, targetId)) throw new Error("crow_choice_invalid");
  const w = windows.get(world)!,
    target = targetId === null ? null : (w.targets.get(targetId) ?? null);
  if (targetId !== null && !target) throw new Error("crow_target_stale");
  // 最后一个目标读取之后再次验 actor，首历史写即付款；付款后即关闭，事实失败也不能重交。
  assertCrowCurrent(world, actorId, day);
  if (!beforeWrite() || (target && !originalPlayerCurrent(world, target)))
    throw new Error("crow_choice_stale");
  assertCrowCurrent(world, actorId, day);
  // push是首语义写；后续JSON编码失败保留历史前缀，不能重新打开相同日期重交。
  commitCrowState(w.state, day, targetId);
  w.target = target;
  w.expected = JSON.stringify(w.state);
  w.pending = false;
}
export function closeCrowNight(world: World): void {
  const w = windows.get(world);
  if (w) w.pending = false;
}
/** 每轮只加一次固定一票，不伪造玩家票据；actor首次死亡保留，目标死亡或任一原体替换撤销效果。 */
export function applyCrowBonus(
  world: World,
  day: number,
  round: 1 | 2,
  tally: Record<number, number>,
  events: GameEvent[],
  candidates?: readonly number[],
): void {
  const w = windows.get(world);
  if (!w || w.day !== day || w.pending || !w.target || w.applied.has(round)) return;
  if (round === 2 && w.state.ballotPolicy !== "all_ballots") return;
  if (
    !originalPlayerSameLife(world, w.actor, true) ||
    w.actor.role.privateState !== w.container ||
    crowState(w.actor.role) !== w.state ||
    JSON.stringify(w.state) !== w.expected ||
    !originalPlayerCurrent(world, w.target) ||
    !canBeExiled(world, w.target.id) ||
    (candidates && !candidates.includes(w.target.id))
  )
    return;
  // participation是可扩展回调；其后必须再次核原体，防止回调改变生命后把票加到新身体。
  if (
    !originalPlayerSameLife(world, w.actor, true) ||
    !originalPlayerCurrent(world, w.target) ||
    w.actor.role.privateState !== w.container ||
    crowState(w.actor.role) !== w.state ||
    JSON.stringify(w.state) !== w.expected
  )
    return;
  const targetId = w.target.id;
  tally[targetId] = (tally[targetId] ?? 0) + 1;
  w.applied.add(round);
  events.push({
    timestamp: Date.now(),
    type: "crow_curse_applied",
    payload: { day, targetId, bonus: 1, round },
  });
}
