/**
 * 负责一夜一次传爪的真实窗口、原候选与转移付款。输入为原 World／角色／日次与选择，输出唯一库存转移。
 * 两端生命、身份、阵营和原库存都在请求前捕获，await 后与首付款前复验；同形 JSON 不可补装能力。
 * 先扣原生单位，再安装受传单位；后者或事实失败保已扣前缀，不把多对象写宣称为原子事务。
 */
import { Camp, type Role } from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import {
  AWAKENED_WOLF_KING_ROLE_ID,
  type AwakenedClawState,
} from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import type { World } from "../../domain/world";
import {
  captureOriginalPlayer,
  originalPlayerCurrent,
  type OriginalPlayerScope,
} from "../../domain/original-player-scope";
import type { RoleCatalog } from "../../rulesets/roles/catalog";
import { knownWolfTeammates } from "../wolf-team/action-ports";
import {
  ownedAwakenedClaws,
  createReceivedClaw,
  nextClawBequest,
  replaceAwakenedClaws,
  installAwakenedClaws,
} from "./state";

interface Candidate {
  actor: OriginalPlayerScope;
  container: object;
}
interface Window {
  actor: OriginalPlayerScope;
  container: object;
  stock: AwakenedClawState;
  day: number;
  pending: boolean;
  candidates: Map<number, Candidate>;
}
const windows = new WeakMap<World, Window>();
function containerOf(role: OriginalPlayerScope["role"]): object | undefined {
  if (types.isProxy(role)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(role, "privateState");
  const value = descriptor && "value" in descriptor ? descriptor.value : undefined;
  return value && typeof value === "object" && !types.isProxy(value) ? value : undefined;
}
function vacant(role: OriginalPlayerScope["role"]): boolean {
  const container = containerOf(role);
  return !!container && Object.getOwnPropertyDescriptor(container, "awakenedClaws") === undefined;
}
function current(world: World, w: Window): boolean {
  return (
    w.pending &&
    originalPlayerCurrent(world, w.actor) &&
    containerOf(w.actor.role) === w.container &&
    ownedAwakenedClaws(world, w.actor.id) === w.stock
  );
}
export function openClawBequest(
  world: World,
  actorId: number,
  day: number,
  catalog: RoleCatalog,
): void {
  const previous = windows.get(world),
    actor = captureOriginalPlayer(world, actorId),
    stock = ownedAwakenedClaws(world, actorId);
  if (
    (previous && (previous.pending || previous.day >= day)) ||
    !actor ||
    String(actor.roleId) !== AWAKENED_WOLF_KING_ROLE_ID ||
    actor.campValue !== Camp.Wolf ||
    !stock ||
    !stock.units.some((u) => u.source.kind === "native" && u.status === "ready") ||
    (stock.bequests.at(-1)?.day ?? 0) >= day
  )
    throw new Error("awakened_claw_bequest_unavailable");
  const candidates = new Map<number, Candidate>();
  for (const id of knownWolfTeammates(world, actorId, catalog)) {
    const target = captureOriginalPlayer(world, id);
    if (target && target.id !== actorId && target.campValue === Camp.Wolf && vacant(target.role))
      candidates.set(id, { actor: target, container: containerOf(target.role)! });
  }
  windows.set(world, {
    actor,
    container: containerOf(actor.role)!,
    stock,
    day,
    pending: true,
    candidates,
  });
}
export function clawBequestCandidates(world: World, actorId: number, day: number): number[] {
  const w = windows.get(world);
  if (!w || w.actor.id !== actorId || w.day !== day || !current(world, w)) return [];
  return [...w.candidates.values()]
    .filter(
      (target) =>
        originalPlayerCurrent(world, target.actor) &&
        containerOf(target.actor.role) === target.container &&
        vacant(target.actor.role),
    )
    .map((target) => target.actor.id);
}
export function assertClawBequestCurrent(world: World, actorId: number, day: number): void {
  const w = windows.get(world);
  if (!w || w.actor.id !== actorId || w.day !== day || !current(world, w))
    throw new Error("awakened_claw_bequest_stale");
}
export function clawBequestAllowed(
  world: World,
  actorId: number,
  day: number,
  targetId: number | null,
): boolean {
  const w = windows.get(world);
  return (
    !!w &&
    w.actor.id === actorId &&
    w.day === day &&
    current(world, w) &&
    (targetId === null || clawBequestCandidates(world, actorId, day).includes(targetId))
  );
}
/** null 只关闭该夜，零库存付款；非空先原单位转出，再给原目标装单爪，不能回滚或送到新身体。 */
export function commitClawBequest(
  world: World,
  actorId: number,
  day: number,
  targetId: number | null,
  beforeWrite: () => boolean,
): { unitId: string; receivedUnitId: string } | null {
  if (!clawBequestAllowed(world, actorId, day, targetId))
    throw new Error("awakened_claw_bequest_invalid");
  const w = windows.get(world)!;
  if (!beforeWrite()) throw new Error("awakened_claw_bequest_revoked");
  assertClawBequestCurrent(world, actorId, day);
  if (targetId === null) {
    w.pending = false;
    return null;
  }
  const target = w.candidates.get(targetId),
    unit = w.stock.units.find((u) => u.source.kind === "native" && u.status === "ready");
  if (
    !target ||
    !unit ||
    !originalPlayerCurrent(world, target.actor) ||
    containerOf(target.actor.role) !== target.container ||
    !vacant(target.actor.role)
  )
    throw new Error("awakened_claw_bequest_target_stale");
  const received = createReceivedClaw(actorId, day, unit),
    next = nextClawBequest(w.stock, unit.id, day, targetId);
  if (
    !beforeWrite() ||
    !originalPlayerCurrent(world, target.actor) ||
    containerOf(target.actor.role) !== target.container ||
    !vacant(target.actor.role) ||
    !current(world, w) ||
    !originalPlayerCurrent(world, target.actor)
  )
    throw new Error("awakened_claw_bequest_target_stale");
  replaceAwakenedClaws(w.actor.role, w.stock, next, target.actor);
  w.stock = next;
  w.pending = false;
  installAwakenedClaws(target.actor.role, received, world, targetId, target.actor);
  return { unitId: unit.id, receivedUnitId: received.units[0]!.id };
}
export function closeClawBequest(world: World): void {
  const w = windows.get(world);
  if (w) w.pending = false;
}
