/**
 * 负责觉醒骑士有限白天边界、成功链和唯一尝试付款。输入为真实阶段边界身份／原玩家与选择，
 * 输出不透明已付提案；全局目标资格只从原attempts历史推导，运行句柄不复制库存、写Alive或推进阶段。
 * 时点是每个Guard已处理的安全边界，真实DR完整返回后才开下一请求；同边界不重问、非法答复不作结束。
 * 首写前在全部外部guard之后稳定核两端原体／Role／Camp及唯一状态CAS；支付后错误保真实尝试前缀。
 * 不变量是每个稳定目标整局只付款一次、仅Wolf分支可同链继续；写权只属原角色唯一attempts槽。
 * 终态关闭只收窗口／链编辑权，不删已付历史、不补正常结束，已付原生命提案仍交真实DR处理。
 */
import { Camp } from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_KNIGHT_ROLE_ID,
  type AwakenedKnightState,
} from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import {
  captureOriginalPlayer,
  originalPlayerCurrent,
  originalPlayerAtCommit,
  type OriginalPlayerScope,
} from "../../domain/original-player-scope";
import type { World } from "../../domain/world";
import { ownedKnightState, prepareDuelAttempts, replaceKnightState } from "./state";

export interface DuelBoundary {
  readonly kind: "awakened_duel_boundary";
}
export interface DuelChain {
  readonly kind: "awakened_duel_chain";
}
export interface PaidDuelAttempt {
  readonly kind: "awakened_duel_attempt";
}
interface Frame {
  readonly world: World;
  readonly actor: OriginalPlayerScope;
  readonly seen: WeakSet<object>;
  state: AwakenedKnightState;
  revoked: boolean;
  active: DuelBoundary | null;
  chain: DuelChain | null;
}
interface Chain {
  readonly frame: Frame;
  readonly day: number;
  readonly ordinal: number;
  open: boolean;
}
interface Boundary {
  readonly frame: Frame;
  readonly day: number;
  readonly previous: DuelChain | null;
  readonly targets: Map<number, OriginalPlayerScope>;
  pending: boolean;
}
interface Attempt {
  readonly frame: Frame;
  readonly day: number;
  readonly chain: DuelChain;
  readonly target: OriginalPlayerScope;
  readonly branch: "wolf" | "good";
}
const frames = new WeakMap<World, Frame>(),
  boundaries = new WeakMap<DuelBoundary, Boundary>(),
  chains = new WeakMap<DuelChain, Chain>(),
  attempts = new WeakMap<PaidDuelAttempt, Attempt>();
function current(f: Frame): boolean {
  if (f.revoked) return false;
  if (
    !originalPlayerCurrent(f.world, f.actor) ||
    ownedKnightState(f.world, f.actor.role) !== f.state
  ) {
    f.revoked = true;
    return false;
  }
  return true;
}
/** 原生安装后的首真实边界建立唯一运行绑定；旧角色World不读本族私有槽。 */
export function prepareAwakenedKnight(
  world: World,
  actorId: number,
  beforeWrite: () => boolean,
): void {
  const old = frames.get(world);
  if (old) {
    if (old.actor.id !== actorId || !current(old) || !beforeWrite())
      throw new Error("awakened_knight_original_revoked");
    return;
  }
  const actor = captureOriginalPlayer(world, actorId),
    state = actor && ownedKnightState(world, actor.role);
  if (!actor || actor.roleId !== AWAKENED_KNIGHT_ROLE_ID || actor.campValue !== Camp.Good || !state)
    throw new Error("awakened_knight_original_invalid");
  const f: Frame = {
    world,
    actor,
    state,
    seen: new WeakSet(),
    revoked: false,
    active: null,
    chain: null,
  };
  if (
    !beforeWrite() ||
    !originalPlayerCurrent(world, actor) ||
    ownedKnightState(world, actor.role) !== state ||
    !originalPlayerAtCommit(world, actor)
  )
    throw new Error("awakened_knight_original_revoked");
  frames.set(world, f);
}
/** 同一真实边界只开放一次；成功续窗必须持本World前一份仍开放的成功链，不能从字段重建。 */
export function openDuelBoundary(
  world: World,
  actorId: number,
  day: number,
  identity: object,
  previous?: DuelChain,
): DuelBoundary | null {
  const f = frames.get(world);
  if (
    !f ||
    f.actor.id !== actorId ||
    !current(f) ||
    !Number.isSafeInteger(day) ||
    day < 1 ||
    f.seen.has(identity)
  )
    return null;
  if (f.active && boundaries.get(f.active)?.pending)
    throw new Error("awakened_duel_boundary_already_open");
  if (previous) {
    const c = chains.get(previous);
    if (!c || c.frame !== f || f.chain !== previous || !c.open || c.day !== day)
      throw new Error("awakened_duel_chain_invalid");
  } else if (f.chain && chains.get(f.chain)?.open)
    throw new Error("awakened_duel_chain_already_open");
  const used = new Set(f.state.attempts.map((a) => a.targetId)),
    targets = new Map<number, OriginalPlayerScope>();
  for (const id of world.getAliveEntityIds()) {
    if (id === actorId || used.has(id)) continue;
    const s = captureOriginalPlayer(world, id);
    if (!s) throw new Error("awakened_duel_roster_stale");
    targets.set(id, s);
  }
  if (!current(f)) throw new Error("awakened_duel_boundary_revoked");
  const handle = Object.freeze({ kind: "awakened_duel_boundary" as const });
  f.seen.add(identity);
  f.active = handle;
  boundaries.set(handle, { frame: f, day, previous: previous ?? null, targets, pending: true });
  return handle;
}
export function duelBoundaryCurrent(world: World, handle: DuelBoundary): boolean {
  const b = boundaries.get(handle),
    f = b?.frame;
  return (
    !!b &&
    !!f &&
    f.world === world &&
    frames.get(world) === f &&
    f.active === handle &&
    b.pending &&
    current(f) &&
    (!b.previous || (f.chain === b.previous && chains.get(b.previous)?.open === true))
  );
}
export function duelBoundaryOptions(world: World, handle: DuelBoundary) {
  if (!duelBoundaryCurrent(world, handle)) return null;
  const b = boundaries.get(handle)!,
    f = b.frame;
  return {
    actorId: f.actor.id,
    day: b.day,
    continuing: b.previous !== null,
    targetIds: [...b.targets].filter(([, s]) => originalPlayerCurrent(world, s)).map(([id]) => id),
  };
}
export function duelChoiceAllowed(
  world: World,
  handle: DuelBoundary,
  targetId: number | null,
): boolean {
  if (!duelBoundaryCurrent(world, handle)) return false;
  if (targetId === null) return true;
  const s = boundaries.get(handle)!.targets.get(targetId);
  return (
    !!s &&
    (s.campValue === Camp.Wolf || s.campValue === Camp.Good) &&
    originalPlayerCurrent(world, s)
  );
}
export type DuelChoiceResult =
  | { readonly kind: "declined" }
  | { readonly kind: "ended"; readonly chain: DuelChain }
  | {
      readonly kind: "attempt";
      readonly chain: DuelChain;
      readonly attempt: PaidDuelAttempt;
      readonly branch: "wolf" | "good";
    };
/** null只结束原边界／已成功链；非空先写唯一attempts，再交惰性真实死亡提案，绝不预先标死。 */
export function commitDuelChoice(
  world: World,
  handle: DuelBoundary,
  targetId: number | null,
  beforeWrite: () => boolean,
): DuelChoiceResult {
  if (!duelChoiceAllowed(world, handle, targetId)) throw new Error("awakened_duel_choice_invalid");
  const b = boundaries.get(handle)!,
    f = b.frame,
    expected = f.state,
    target = targetId === null ? null : b.targets.get(targetId)!;
  const branch = target?.campValue === Camp.Wolf ? "wolf" : "good";
  const ordinal = b.previous
    ? chains.get(b.previous)!.ordinal
    : (expected.attempts.at(-1)?.chain ?? 0) + 1;
  const next = target
    ? prepareDuelAttempts([
        ...expected.attempts,
        { day: b.day, chain: ordinal, targetId: target.id, branch },
      ])
    : null;
  if (
    !beforeWrite() ||
    !duelBoundaryCurrent(world, handle) ||
    f.state !== expected ||
    (target && !originalPlayerCurrent(world, target))
  )
    throw new Error("awakened_duel_choice_revoked");
  if (
    !originalPlayerAtCommit(world, f.actor) ||
    (target && !originalPlayerAtCommit(world, target)) ||
    ownedKnightState(world, f.actor.role) !== expected
  )
    throw new Error("awakened_duel_choice_revoked");
  if (next) {
    replaceKnightState(world, f.actor.role, expected, next);
    f.state = next;
  }
  b.pending = false;
  f.active = null;
  if (!target) {
    if (!b.previous) return { kind: "declined" };
    chains.get(b.previous)!.open = false;
    f.chain = null;
    return { kind: "ended", chain: b.previous };
  }
  const chain = b.previous ?? Object.freeze({ kind: "awakened_duel_chain" as const });
  if (!b.previous) chains.set(chain, { frame: f, day: b.day, ordinal, open: true });
  f.chain = chain;
  if (branch === "good") chains.get(chain)!.open = false;
  const attempt = Object.freeze({ kind: "awakened_duel_attempt" as const });
  attempts.set(attempt, { frame: f, day: b.day, chain, target, branch });
  return { kind: "attempt", chain, attempt, branch };
}
/** 真实付款只读提案保持原body；施者随后出局不撤回已付提案，同号新体也不继承原致死。 */
export function paidDuelProposal(world: World, token: PaidDuelAttempt) {
  const a = attempts.get(token);
  if (!a || a.frame.world !== world) throw new Error("awakened_duel_attempt_invalid");
  const targets = a.branch === "wolf" ? [a.target] : [a.frame.actor, a.target];
  return {
    day: a.day,
    actorId: a.frame.actor.id,
    targetId: a.target.id,
    branch: a.branch,
    chain: chains.get(a.chain)!.ordinal,
    deaths: targets.map((s) => s.id),
    originalLives: new Map(targets.map((s) => [s.id, { life: s.life, version: s.version }])),
  };
}
export function duelChainCurrent(world: World, chain: DuelChain): boolean {
  const c = chains.get(chain);
  return (
    !!c &&
    c.frame.world === world &&
    frames.get(world) === c.frame &&
    c.frame.chain === chain &&
    c.open &&
    current(c.frame)
  );
}
/** 失败只收原窗口／链编辑权，不伪造ended或清尝试；已付提案和真实死亡由原DR继续拥有。 */
export function closeDuelBoundary(handle: DuelBoundary): void {
  const b = boundaries.get(handle);
  if (!b) return;
  b.pending = false;
  if (b.frame.active === handle) b.frame.active = null;
}
export function closeDuelChain(world: World, chain: DuelChain): void {
  const c = chains.get(chain);
  if (!c || c.frame.world !== world) throw new Error("awakened_duel_chain_invalid");
  c.open = false;
  if (c.frame.chain === chain) {
    c.frame.chain = null;
    if (c.frame.active) closeDuelBoundary(c.frame.active);
  }
}
export function duelActorChoiceAllowed(
  world: World,
  actorId: number,
  day: number,
  targetId: number | null,
): boolean {
  const f = frames.get(world),
    b = f?.active && boundaries.get(f.active);
  return (
    !!f &&
    !!b &&
    f.actor.id === actorId &&
    b.day === day &&
    duelChoiceAllowed(world, f.active!, targetId)
  );
}
