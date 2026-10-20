/**
 * 负责觉醒狼美人的原体夜窗、隔夜魅惑与一次替死付款。输入为真实夜号、原候选及致死提案，
 * 输出当夜关系或不透明已付替死receipt；始终由choices推导冷却、由replacement推导once，不复制库存。
 * 本owner只提交私态，不标死或复活。新夜先过期旧关系，关闭窗口不能重开；失败／撤权不消费新机会，
 * 已付一次不能因日志失败退还。每次外部guard之后、首写前稳定核原actor与原target，不把同座新body当旧关系。
 */
import { Camp, Phase, type DeathCause } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../domain/world";
import type { NightLifeScope } from "../../domain/night-effects";
import {
  captureOriginalPlayer,
  originalPlayerAtCommit,
  type OriginalPlayerScope,
} from "../../domain/original-player-scope";
import { nightPatrolSuppressesBeauty, type PaidPatrolProposal } from "../awakened-hunter/ports";
import {
  getAwakenedBeautyState,
  prepareAwakenedBeautyState,
  replaceAwakenedBeautyState,
} from "./state";

interface Frame {
  readonly actor: OriginalPlayerScope;
  night: number;
  offered: boolean;
  closed: boolean;
  revoked: boolean;
  readonly revokedTargets: Set<OriginalPlayerScope>;
  targets: Map<number, OriginalPlayerScope>;
  relation: OriginalPlayerScope | null;
}
const frames = new WeakMap<World, Frame>();
export function hasAwakenedBeautyFrame(world: World): boolean {
  return frames.has(world);
}
export interface PaidBeautyReplacement {
  readonly kind: "awakened-beauty-replacement";
}
interface ReplacementData {
  readonly world: World;
  readonly actor: OriginalPlayerScope;
  readonly target: OriginalPlayerScope;
  readonly day: number;
  readonly phase: Phase;
  readonly rootPhase: Phase;
  readonly causes: readonly DeathCause[];
  readonly state: NonNullable<ReturnType<typeof getAwakenedBeautyState>>;
  revoked: boolean;
}
const replacements = new WeakMap<PaidBeautyReplacement, ReplacementData>();
function actorCurrent(world: World, frame: Frame): boolean {
  if (frame.revoked) return false;
  const current =
    originalPlayerAtCommit(world, frame.actor) && !!getAwakenedBeautyState(frame.actor.role);
  if (!current) frame.revoked = true;
  return current;
}
function targetCurrent(world: World, frame: Frame, target: OriginalPlayerScope): boolean {
  if (frame.revokedTargets.has(target)) return false;
  const current = originalPlayerAtCommit(world, target);
  if (!current) frame.revokedTargets.add(target);
  return current;
}
/** 每个真实开夜的早期owned阶段调用；冷却夜虽无Agent请求，也必须先让上夜关系到期。 */
export function prepareAwakenedBeautyNight(
  world: World,
  actorId: number | null,
  day: number,
  isCurrent: () => boolean,
): void {
  if (!Number.isSafeInteger(day) || day < 1) throw new Error("awakened_beauty_night_invalid");
  let frame = frames.get(world);
  if (!frame && actorId === null) return;
  if (frame && frame.night >= day) throw new Error("awakened_beauty_night_already_prepared");
  if (!frame) {
    const actor = actorId === null ? null : captureOriginalPlayer(world, actorId);
    if (
      day !== 1 ||
      !actor ||
      actor.roleId !== "awakened_wolf_beauty" ||
      actor.campValue !== Camp.Wolf ||
      !getAwakenedBeautyState(actor.role)
    )
      throw new Error("awakened_beauty_owner_invalid");
    frame = {
      actor,
      night: 0,
      offered: false,
      closed: false,
      revoked: false,
      revokedTargets: new Set(),
      targets: new Map(),
      relation: null,
    };
  }
  if (!isCurrent()) throw new Error("awakened_beauty_night_revoked");
  if (
    actorId === null &&
    (!originalPlayerAtCommit(world, frame.actor, true) || !getAwakenedBeautyState(frame.actor.role))
  )
    frame.revoked = true;
  if (actorId !== null && (frame.actor.id !== actorId || !actorCurrent(world, frame)))
    throw new Error("awakened_beauty_owner_revoked");
  frame.night = day;
  frame.offered = false;
  frame.closed = actorId === null;
  frame.targets = new Map();
  frame.relation = null;
  frames.set(world, frame);
}
function canCharm(world: World, frame: Frame): boolean {
  const state = getAwakenedBeautyState(frame.actor.role);
  if (frame.closed || !actorCurrent(world, frame) || !state || state.replacement) return false;
  let previous = 0;
  for (const choice of state.choices) if (choice.targetId !== null) previous = choice.day;
  return previous === 0 || frame.night >= previous + 2;
}
export function openAwakenedCharm(world: World, actorId: number, day: number): boolean {
  const frame = frames.get(world);
  if (!frame || frame.actor.id !== actorId || frame.night !== day || frame.offered)
    throw new Error("awakened_charm_window_invalid");
  frame.offered = true;
  if (!canCharm(world, frame)) {
    frame.closed = true;
    return false;
  }
  for (const id of world.getAliveEntityIds()) {
    if (id === actorId) continue;
    const scope = captureOriginalPlayer(world, id);
    if (!scope) throw new Error("awakened_charm_roster_stale");
    frame.targets.set(id, scope);
  }
  if (!actorCurrent(world, frame)) throw new Error("awakened_charm_owner_revoked");
  if (!frame.targets.size) {
    frame.closed = true;
    return false;
  }
  return true;
}
export function awakenedCharmCurrent(world: World, actorId: number, day: number): boolean {
  const frame = frames.get(world);
  return (
    !!frame &&
    frame.actor.id === actorId &&
    frame.night === day &&
    frame.offered &&
    canCharm(world, frame)
  );
}
export function awakenedCharmCandidates(
  world: World,
  actorId: number,
  day: number,
): readonly number[] {
  const frame = frames.get(world);
  return frame && awakenedCharmCurrent(world, actorId, day)
    ? [...frame.targets].filter(([, scope]) => targetCurrent(world, frame, scope)).map(([id]) => id)
    : [];
}
/** 只作工具预检；付款仍复验同一原窗／原体及末查询之后的候选。 */
export function awakenedCharmChoiceAllowed(
  world: World,
  actorId: number,
  day: number,
  targetId: number | null,
): boolean {
  if (!awakenedCharmCurrent(world, actorId, day)) return false;
  if (targetId === null) return true;
  const frame = frames.get(world)!,
    target = frame.targets.get(targetId);
  return !!target && targetCurrent(world, frame, target);
}
export function payAwakenedCharm(
  world: World,
  actorId: number,
  day: number,
  targetId: number | null,
  beforeWrite: () => boolean,
): void {
  const frame = frames.get(world);
  if (!frame || !awakenedCharmCurrent(world, actorId, day))
    throw new Error("awakened_charm_unavailable");
  const expected = getAwakenedBeautyState(frame.actor.role)!,
    target = targetId === null ? null : frame.targets.get(targetId);
  if (targetId !== null && (!target || !targetCurrent(world, frame, target)))
    throw new Error("awakened_charm_target_invalid");
  const next = prepareAwakenedBeautyState({
    ...expected,
    choices: [...expected.choices, { day, targetId }],
  });
  if (
    !beforeWrite() ||
    frames.get(world) !== frame ||
    !awakenedCharmCurrent(world, actorId, day) ||
    getAwakenedBeautyState(frame.actor.role) !== expected ||
    !originalPlayerAtCommit(world, frame.actor) ||
    (target && !targetCurrent(world, frame, target))
  )
    throw new Error("awakened_charm_payment_revoked");
  replaceAwakenedBeautyState(frame.actor.role, expected, next);
  frame.relation = target ?? null;
  frame.closed = true;
}
export function closeAwakenedCharm(world: World, actorId: number, day: number): void {
  const frame = frames.get(world);
  if (frame?.actor.id === actorId && frame.night === day) frame.closed = true;
}
/** 同一独立波已有致死目标不能充当替身。Night巡猎只接受真实已付内存证明，不接受JSON抑制旗标。 */
export function payAwakenedBeautyReplacement(
  world: World,
  day: number,
  phase: Phase,
  rootPhase: Phase,
  threatened: NightLifeScope,
  causes: readonly DeathCause[],
  independentDeaths: ReadonlySet<number>,
  patrol: PaidPatrolProposal | undefined,
  beforeWrite: () => boolean,
): PaidBeautyReplacement | null {
  const frame = frames.get(world);
  if (
    !frame ||
    frame.night !== day ||
    frame.actor.id !== threatened.id ||
    frame.actor.life !== threatened.life ||
    frame.actor.version !== threatened.version ||
    !actorCurrent(world, frame)
  )
    return null;
  const target = frame.relation,
    expected = getAwakenedBeautyState(frame.actor.role)!;
  if (
    !target ||
    expected.replacement ||
    !targetCurrent(world, frame, target) ||
    independentDeaths.has(target.id)
  )
    return null;
  if (
    causes.includes("awakened_patrol" as DeathCause) &&
    patrol &&
    nightPatrolSuppressesBeauty(world, patrol, day, threatened)
  )
    return null;
  const next = prepareAwakenedBeautyState({
    ...expected,
    replacement: {
      day,
      phase,
      rootPhase,
      targetId: target.id,
      preventedCauses: [...causes],
    },
  });
  if (
    !beforeWrite() ||
    frames.get(world) !== frame ||
    frame.night !== day ||
    frame.relation !== target ||
    getAwakenedBeautyState(frame.actor.role) !== expected ||
    independentDeaths.has(target.id) ||
    !originalPlayerAtCommit(world, frame.actor) ||
    !targetCurrent(world, frame, target)
  )
    throw new Error("awakened_beauty_replacement_revoked");
  replaceAwakenedBeautyState(frame.actor.role, expected, next);
  const receipt: PaidBeautyReplacement = Object.freeze({ kind: "awakened-beauty-replacement" });
  replacements.set(receipt, {
    world,
    actor: frame.actor,
    target,
    day,
    phase,
    rootPhase,
    causes: Object.freeze([...causes]),
    state: next,
    revoked: false,
  });
  return receipt;
}
/** 付款元数据仅作证据；不因之后日志／身份变动抹掉已付receipt，也不由此授权生命写入。 */
export function readPaidBeautyReplacement(
  world: World,
  receipt: PaidBeautyReplacement,
  day: number,
): {
  actorId: number;
  target: NightLifeScope;
  phase: Phase;
  rootPhase: Phase;
  causes: readonly DeathCause[];
} | null {
  const paid = replacements.get(receipt);
  return paid?.world === world && paid.day === day
    ? {
        actorId: paid.actor.id,
        target: { id: paid.target.id, life: paid.target.life, version: paid.target.version },
        phase: paid.phase,
        rootPhase: paid.rootPhase,
        causes: [...paid.causes],
      }
    : null;
}
/** 真标死前另核已付原target；查询撤权后不补杀同座新body，恢复旧引用不重获待执行伤害。 */
export function beautyReplacementTargetCurrent(
  world: World,
  receipt: PaidBeautyReplacement,
  day: number,
): boolean {
  const paid = replacements.get(receipt);
  if (!paid || paid.world !== world || paid.day !== day || paid.revoked) return false;
  if (!originalPlayerAtCommit(world, paid.target)) {
    paid.revoked = true;
    return false;
  }
  return true;
}
