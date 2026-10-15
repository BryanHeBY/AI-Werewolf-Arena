/**
 * 负责觉醒守卫实际开夜周期、有限安全边界和唯一保护付款。输入为原World／夜状态身份／边界与显式选择，
 * 输出本族历史和已付原目标保护；仅本模块可修改窗口，资源只写原cycles槽，不持第二份次数。
 * 不变量是一个实际周期最多一份protect或pass，同边界不重问；首写前外部guard及稳定两端原体都必须通过。
 * 已付盾保至真日终／下一实际开夜，不依赖施者新Role或私库；失败保原付款，未付撤权不假造正常到期。
 */
import { Camp, type Phase, type DeathCause } from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_GUARD_ROLE_ID,
  type AwakenedGuardCycle,
  type AwakenedGuardState,
} from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import {
  captureOriginalPlayer,
  originalPlayerCurrent,
  originalPlayerAtCommit,
  type OriginalPlayerScope,
} from "../../domain/original-player-scope";
import { COMPONENT } from "../../domain/components/names";
import { aliveLifeDescriptor, aliveLifeVersion } from "../../domain/components/alive";
import { readWorldComponentAtCommit, type World } from "../../domain/world";
import type { NightLifeReadScope } from "../../domain/night-effects";
import { types } from "node:util";
import { ownedGuardState, prepareGuardCycles, replaceGuardState } from "./state";
export interface GuardChoice {
  readonly mode: "protect" | "wait" | "pass";
  readonly targetId: number | null;
}
export interface GuardBoundary {
  readonly kind: "awakened_guard_boundary";
}
interface Cycle {
  readonly world: World;
  readonly actor: OriginalPlayerScope;
  readonly night: object;
  readonly day: number;
  readonly seen: WeakSet<object>;
  state: AwakenedGuardState;
  closed: boolean;
  revoked: boolean;
  active: GuardBoundary | null;
  protectedTarget: OriginalPlayerScope | null;
  protectionRevoked: boolean;
}
interface Boundary {
  readonly cycle: Cycle;
  readonly timing: "night" | "day";
  readonly last: boolean;
  readonly targets: Map<number, OriginalPlayerScope>;
  pending: boolean;
}
const cycles = new WeakMap<World, Cycle>(),
  boundaries = new WeakMap<GuardBoundary, Boundary>();
/** 组合根的未安装早退，不读取World/config，也不授保护或动作权限。 */
export function hasAwakenedGuardFrame(world: World): boolean {
  return cycles.has(world);
}
function executable(c: Cycle): boolean {
  if (c.closed || c.revoked) return false;
  const current =
    originalPlayerCurrent(c.world, c.actor) && ownedGuardState(c.world, c.actor.role) === c.state;
  if (!current) c.revoked = true;
  return current;
}
function unspent(c: Cycle): boolean {
  return c.state.cycles.at(-1)?.status === "open";
}
/** 只由真实夜流水线用当夜原state对象开启；相同日次／标签不能复制免费单位。 */
export function beginGuardCycle(
  world: World,
  actorId: number,
  day: number,
  night: object,
  beforeWrite: () => boolean,
): void {
  const prev = cycles.get(world);
  if (prev?.night === night) {
    if (prev.day !== day || prev.actor.id !== actorId)
      throw new Error("awakened_guard_cycle_invalid");
    return;
  }
  const actor = captureOriginalPlayer(world, actorId),
    state = actor && ownedGuardState(world, actor.role);
  if (
    !actor ||
    actor.roleId !== AWAKENED_GUARD_ROLE_ID ||
    actor.campValue !== Camp.Good ||
    !state ||
    day !== state.cycles.length + 1 ||
    (prev &&
      (prev.actor.role !== actor.role || prev.revoked || !originalPlayerCurrent(world, prev.actor)))
  )
    throw new Error("awakened_guard_cycle_invalid");
  const history = state.cycles.map((c) =>
      c.status === "open" ? { day: c.day, status: "unused" as const } : c,
    ),
    next = prepareGuardCycles([...history, { day, status: "open" }]);
  if (
    !beforeWrite() ||
    !originalPlayerCurrent(world, actor) ||
    ownedGuardState(world, actor.role) !== state ||
    !originalPlayerAtCommit(world, actor)
  )
    throw new Error("awakened_guard_cycle_revoked");
  replaceGuardState(world, actor.role, state, next);
  if (prev) {
    prev.closed = true;
    const old = prev.active && boundaries.get(prev.active);
    if (old) old.pending = false;
  }
  cycles.set(world, {
    world,
    actor,
    night,
    day,
    state: next,
    seen: new WeakSet(),
    closed: false,
    revoked: false,
    active: null,
    protectedTarget: null,
    protectionRevoked: false,
  });
}
/** 同一具名边界只开一次；已守／整单位pass不再请求，所有候选生命在await前捕获。 */
export function openGuardBoundary(
  world: World,
  day: number,
  identity: object,
  timing: "night" | "day",
  last = false,
): GuardBoundary | null {
  const c = cycles.get(world);
  if (!c || c.day !== day || !executable(c) || !unspent(c)) return null;
  if (c.seen.has(identity)) return null;
  if (c.active && boundaries.get(c.active)?.pending)
    throw new Error("awakened_guard_boundary_already_open");
  const previous = c.state.cycles.at(-2),
    forbidden = previous?.status === "protected" ? previous.targetId : null,
    targets = new Map<number, OriginalPlayerScope>();
  for (const id of world.getAliveEntityIds()) {
    if (id === forbidden) continue;
    const s = captureOriginalPlayer(world, id);
    if (!s) throw new Error("awakened_guard_roster_stale");
    targets.set(id, s);
  }
  if (!executable(c)) throw new Error("awakened_guard_boundary_revoked");
  const handle = Object.freeze({ kind: "awakened_guard_boundary" as const });
  c.seen.add(identity);
  c.active = handle;
  boundaries.set(handle, { cycle: c, timing, last, targets, pending: true });
  return handle;
}
export function guardBoundaryCurrent(world: World, handle: GuardBoundary): boolean {
  const w = boundaries.get(handle),
    c = w?.cycle;
  return (
    !!w &&
    !!c &&
    c.world === world &&
    cycles.get(world) === c &&
    c.active === handle &&
    w.pending &&
    executable(c) &&
    unspent(c)
  );
}
export function guardBoundaryOptions(world: World, handle: GuardBoundary) {
  if (!guardBoundaryCurrent(world, handle)) return null;
  const w = boundaries.get(handle)!,
    c = w.cycle;
  return {
    actorId: c.actor.id,
    day: c.day,
    timing: w.timing,
    last: w.last,
    targetIds: [...w.targets].filter(([, s]) => originalPlayerCurrent(world, s)).map(([id]) => id),
  };
}
export function guardChoiceAllowed(
  world: World,
  handle: GuardBoundary,
  choice: GuardChoice,
): boolean {
  if (!guardBoundaryCurrent(world, handle)) return false;
  if (choice.mode === "wait" || choice.mode === "pass") return choice.targetId === null;
  const target =
    choice.targetId === null ? null : boundaries.get(handle)!.targets.get(choice.targetId);
  return choice.mode === "protect" && !!target && originalPlayerCurrent(world, target);
}
/** wait不付款；末机会wait只记真实unused，pass关闭本单位，protect先唯一历史付款再保存原体效果证明。 */
export function commitGuardChoice(
  world: World,
  handle: GuardBoundary,
  choice: GuardChoice,
  beforeWrite: () => boolean,
): "protected" | "wait" | "passed" | "unused" {
  const mode = choice.mode,
    targetId = choice.targetId;
  if (!guardChoiceAllowed(world, handle, { mode, targetId }))
    throw new Error("awakened_guard_choice_invalid");
  const w = boundaries.get(handle)!,
    c = w.cycle,
    expected = c.state,
    target = targetId === null ? null : w.targets.get(targetId)!;
  const status =
      mode === "protect" ? "protected" : mode === "pass" ? "passed" : w.last ? "unused" : "wait",
    row: AwakenedGuardCycle =
      status === "protected"
        ? { day: c.day, status, targetId: targetId!, timing: w.timing }
        : { day: c.day, status: status as "passed" | "unused" },
    next = status === "wait" ? null : prepareGuardCycles([...expected.cycles.slice(0, -1), row]);
  if (
    !beforeWrite() ||
    !guardBoundaryCurrent(world, handle) ||
    c.state !== expected ||
    (target && !originalPlayerCurrent(world, target))
  )
    throw new Error("awakened_guard_choice_revoked");
  if (
    !originalPlayerAtCommit(world, c.actor) ||
    (target && !originalPlayerAtCommit(world, target)) ||
    ownedGuardState(world, c.actor.role) !== expected
  )
    throw new Error("awakened_guard_choice_revoked");
  if (next) {
    replaceGuardState(world, c.actor.role, expected, next);
    c.state = next;
  }
  if (status === "protected") c.protectedTarget = target;
  w.pending = false;
  c.active = null;
  return status;
}
/** 未付失败只关该原请求，不补pass或正常日终；同identity墓碑保留。 */
export function closeGuardBoundary(handle: GuardBoundary): void {
  const w = boundaries.get(handle);
  if (!w) return;
  w.pending = false;
  if (w.cycle.active === handle) w.cycle.active = null;
}
/** 正常结束关闭现周期；取消仅关闭运行范围，不伪造资源历史的正常unused。 */
export function endGuardCycle(
  world: World,
  day: number,
  completed: boolean,
): { readonly actorId: number; readonly day: number } | undefined {
  const c = cycles.get(world);
  if (!c || c.day !== day || c.closed) return;
  c.closed = true;
  if (c.active) closeGuardBoundary(c.active);
  if (completed && unspent(c) && ownedGuardState(world, c.actor.role) === c.state) {
    const next = prepareGuardCycles([...c.state.cycles.slice(0, -1), { day, status: "unused" }]);
    replaceGuardState(world, c.actor.role, c.state, next);
    c.state = next;
  }
  return Object.freeze({ actorId: c.actor.id, day: c.day });
}
/** 只读已付原目标：施者后续换体／身份／私库不取得编辑权，既有盾仍到实际周期终点。 */
export function shieldForDeath(world: World, day: number, target: NightLifeReadScope): boolean {
  const c = cycles.get(world),
    original = c?.protectedTarget;
  if (!c || c.day !== day || c.closed || c.protectionRevoked || !original) return false;
  if (!target || typeof target !== "object" || types.isProxy(target)) return false;
  const field = (key: string) => {
      const d = Object.getOwnPropertyDescriptor(target, key);
      return d && "value" in d ? d.value : undefined;
    },
    id = field("id"),
    life = field("life"),
    version = field("version");
  if (id !== original.id) return false;
  const actual = readWorldComponentAtCommit(world, original.id, COMPONENT.Alive),
    factory = aliveLifeDescriptor(original.life),
    descriptor = Object.getOwnPropertyDescriptor(original.life, "alive");
  const current =
    actual === original.life &&
    !!factory &&
    !!descriptor &&
    descriptor.get === factory.get &&
    descriptor.set === factory.set &&
    aliveLifeVersion(original.life) === original.version &&
    original.life.alive;
  if (!current) c.protectionRevoked = true;
  return current && life === original.life && version === original.version;
}

/** 仅真实已付原目标可生成阻挡事实输入；不交出施者私态或写口，调用方仍只拥有原死亡提案。 */
export function prepareProtectionBlock(
  world: World,
  day: number,
  target: NightLifeReadScope,
  phase: Phase,
  rootPhase: Phase,
  causes: readonly DeathCause[],
) {
  // 先复制可能带外部迭代器的死因，最后才稳定核原生命；返回仅惰性自有数据。
  const copied = Object.freeze([...causes]);
  if (!shieldForDeath(world, day, target)) return null;
  const c = cycles.get(world)!;
  return Object.freeze({
    actorId: c.actor.id,
    targetId: c.protectedTarget!.id,
    day,
    phase,
    rootPhase,
    causes: copied,
  });
}
export function guardActorChoiceAllowed(
  world: World,
  actorId: number,
  day: number,
  choice: GuardChoice,
): boolean {
  const c = cycles.get(world);
  return (
    !!c &&
    c.actor.id === actorId &&
    c.day === day &&
    !!c.active &&
    guardChoiceAllowed(world, c.active, choice)
  );
}
