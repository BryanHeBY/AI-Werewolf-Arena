/**
 * 负责禁言长老真实夜窗、已付原生命绑定与白天表达窗口的唯一写权。
 * 输入为原 World、日次和已校验候选，输出为付款或表达许可；可序列化历史不授予这些权限。
 * 夜间首写前复验原角色／生命／状态；付款后不再借施者存活维持效果，目标与译者换体则失效。
 * 每个日期与表达轮次只打开一次，失败关闭不重开；已付选择与已发表手势不因后续失败回滚。
 */
import { Camp } from "@ai-werewolf-arena/game-contract";
import {
  SILENCE_ELDER_ROLE_ID,
  type SilenceElderState,
  type SilenceExpressionRound,
} from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import type { World } from "../../domain/world";
import {
  captureOriginalPlayer,
  originalPlayerCurrent,
  type OriginalPlayerScope,
} from "../../domain/original-player-scope";
import { getSilenceElderState, nextSilenceElderChoice, replaceSilenceElderState } from "./state";

/** 库存只在角色数据槽；这里仅持原夜窗、实际付款后的原体绑定及一次性表达游标。 */
interface SilenceWindow {
  actor: OriginalPlayerScope;
  container: object;
  state: SilenceElderState;
  day: number;
  pending: boolean;
  originals: ReadonlyMap<number, OriginalPlayerScope>;
  paid: { target: OriginalPlayerScope; translator: OriginalPlayerScope | null } | null;
  announced: boolean;
  expired: boolean;
  rounds: Set<SilenceExpressionRound>;
  expression?: SilenceExpression;
}
/** 不透明运行句柄由本族创建；请求体或相同字段对象不能重建其身份。 */
export interface SilenceExpression {
  readonly day: number;
  readonly targetId: number;
  readonly translatorId: number | null;
  readonly round: SilenceExpressionRound;
}
interface ExpressionState {
  window: SilenceWindow;
  status: "gesture" | "translation" | "closed";
}
const windows = new WeakMap<World, SilenceWindow>();
const expressions = new WeakMap<SilenceExpression, ExpressionState>();

function nightCurrent(world: World, window: SilenceWindow): boolean {
  return (
    window.pending &&
    !window.expired &&
    originalPlayerCurrent(world, window.actor) &&
    Object.getOwnPropertyDescriptor(window.actor.role, "privateState")?.value ===
      window.container &&
    getSilenceElderState(window.actor.role) === window.state
  );
}

export function openSilenceNight(world: World, actorId: number, day: number): void {
  const actor = captureOriginalPlayer(world, actorId);
  const state = getSilenceElderState(actor?.role);
  if (
    !actor ||
    actor.roleId !== SILENCE_ELDER_ROLE_ID ||
    actor.campValue !== Camp.Good ||
    !state ||
    windows.get(world)?.pending ||
    (state.history.at(-1)?.day ?? 0) >= day ||
    (windows.get(world)?.day ?? 0) >= day
  )
    throw new Error("silence_night_unavailable");
  const originals = new Map<number, OriginalPlayerScope>();
  for (const id of world.getAliveEntityIds()) {
    const original = captureOriginalPlayer(world, id);
    if (!original) throw new Error("silence_roster_stale");
    originals.set(id, original);
  }
  windows.set(world, {
    actor,
    container: actor.role.privateState,
    state,
    day,
    pending: true,
    originals,
    paid: null,
    announced: false,
    expired: false,
    rounds: new Set(),
  });
}

export function silenceNightCurrent(world: World, actorId: number, day: number): boolean {
  const w = windows.get(world);
  return !!w && w.actor.id === actorId && w.day === day && nightCurrent(world, w);
}

export function silenceCandidates(world: World, actorId: number, day: number): number[] {
  const w = windows.get(world);
  return w && silenceNightCurrent(world, actorId, day)
    ? [...w.originals.values()].filter((p) => originalPlayerCurrent(world, p)).map((p) => p.id)
    : [];
}

export function silenceChoiceAllowed(
  world: World,
  actorId: number,
  day: number,
  targetId: number,
  translatorId: number | null,
): boolean {
  const w = windows.get(world);
  if (!w || !silenceNightCurrent(world, actorId, day)) return false;
  const target = w.originals.get(targetId);
  const translator = translatorId === null ? null : w.originals.get(translatorId);
  return (
    !!target &&
    originalPlayerCurrent(world, target) &&
    (translatorId === null ||
      (translatorId !== targetId && !!translator && originalPlayerCurrent(world, translator)))
  );
}

export function commitSilenceChoice(
  world: World,
  actorId: number,
  day: number,
  targetId: number,
  translatorId: number | null,
  beforeWrite: () => boolean,
): void {
  if (!silenceChoiceAllowed(world, actorId, day, targetId, translatorId))
    throw new Error("silence_choice_invalid");
  const w = windows.get(world)!;
  const next = nextSilenceElderChoice(w.state, { day, targetId, translatorId });
  const target = w.originals.get(targetId)!;
  const translator = translatorId === null ? null : w.originals.get(translatorId)!;
  // 租约可能执行当前性回调；最后再查所有原体，首个槽替换才是付款。
  if (
    !beforeWrite() ||
    !originalPlayerCurrent(world, target) ||
    (translator && !originalPlayerCurrent(world, translator)) ||
    !silenceNightCurrent(world, actorId, day)
  )
    throw new Error("silence_choice_revoked");
  replaceSilenceElderState(w.actor.role, w.state, next);
  w.state = next;
  w.paid = { target, translator };
  w.pending = false;
}

export function closeSilenceNight(world: World): void {
  const w = windows.get(world);
  if (w) w.pending = false;
}

/** 只公开实际仍可参与普通发言的原目标；原长老身份从不进入公告。 */
export function pendingSilenceAnnouncement(
  world: World,
  day: number,
): { targetId: number; translatorId: number | null } | null {
  const w = windows.get(world);
  if (!w || w.day !== day || w.expired || w.announced || !w.paid) return null;
  if (!originalPlayerCurrent(world, w.paid.target)) return null;
  return {
    targetId: w.paid.target.id,
    translatorId:
      w.paid.translator && originalPlayerCurrent(world, w.paid.translator)
        ? w.paid.translator.id
        : null,
  };
}

export function markSilenceAnnounced(world: World, day: number): void {
  const w = windows.get(world);
  if (!w || w.day !== day || w.expired || !w.paid) throw new Error("silence_announcement_stale");
  w.announced = true;
}

export function openSilenceExpression(
  world: World,
  day: number,
  actorId: number,
  round: SilenceExpressionRound,
): SilenceExpression | null {
  const w = windows.get(world);
  if (
    !w ||
    w.day !== day ||
    w.expired ||
    !w.announced ||
    !w.paid ||
    w.paid.target.id !== actorId ||
    !originalPlayerCurrent(world, w.paid.target)
  )
    return null;
  if (w.rounds.has(round)) throw new Error("silence_expression_already_opened");
  if (w.expression && expressions.get(w.expression)?.status !== "closed")
    throw new Error("silence_expression_in_progress");
  const expression = Object.freeze({
    day,
    targetId: actorId,
    translatorId:
      w.paid.translator && originalPlayerCurrent(world, w.paid.translator)
        ? w.paid.translator.id
        : null,
    round,
  });
  w.rounds.add(round);
  w.expression = expression;
  expressions.set(expression, { window: w, status: "gesture" });
  return expression;
}

export function silenceExpressionCurrent(
  world: World,
  expression: SilenceExpression,
  actorId: number,
  kind: "gesture" | "translation",
): boolean {
  const state = expressions.get(expression);
  if (!state || state.status !== kind) return false;
  const w = state.window;
  if (
    windows.get(world) !== w ||
    w.expression !== expression ||
    w.expired ||
    !w.paid ||
    !originalPlayerCurrent(world, w.paid.target)
  )
    return false;
  return kind === "gesture"
    ? actorId === expression.targetId
    : actorId === expression.translatorId &&
        !!w.paid.translator &&
        originalPlayerCurrent(world, w.paid.translator);
}

/** 网关只核本次已开表达窗；真正发表仍由持有原不透明句柄的窗口复验并提交。 */
export function silenceExpressionActionAllowed(
  world: World,
  day: number,
  actorId: number,
  kind: "gesture" | "translation",
): boolean {
  const w = windows.get(world);
  return (
    !!w &&
    w.day === day &&
    !!w.expression &&
    silenceExpressionCurrent(world, w.expression, actorId, kind)
  );
}

/** 先发布手势再进入独立翻译请求；后续拒绝或错误不能重放先前手势。 */
export function finishSilenceGesture(world: World, expression: SilenceExpression): void {
  if (!silenceExpressionCurrent(world, expression, expression.targetId, "gesture"))
    throw new Error("silence_gesture_revoked");
  expressions.get(expression)!.status = "translation";
}

export function closeSilenceExpression(expression: SilenceExpression): void {
  const state = expressions.get(expression);
  if (state) state.status = "closed";
}

/** 阶段 owner 在普通日终／自爆跳日调用；到期不转存下一天，也不修改已付夜间历史。 */
export function expireSilence(world: World, day: number): number | null {
  const w = windows.get(world);
  if (!w || w.day !== day || w.expired) return null;
  w.expired = true;
  w.pending = false;
  if (w.expression) closeSilenceExpression(w.expression);
  return w.paid?.target.id ?? null;
}
