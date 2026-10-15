/**
 * 负责禁言目标手势及随后译者的两个独立请求，输入为原表达句柄、日次、阶段和运行端口。
 * 输出只为实际手势／翻译事实；不恢复普通发言、不替玩家生成翻译，不控制阶段或投票资格。
 * 每个等待与外部网关之后复验本族原体和期限；首份处理落定才完成 true，后续错误保留已发表前缀。
 * finally 关闭每份租约及原表达窗；清理失败不能覆盖原业务异常，也不能把缺失响应解释为明确拒译。
 */
import { Phase, type GameEvent } from "@ai-werewolf-arena/game-contract";
import {
  SILENCE_ELDER_POLICY,
  type SilenceExpressionRound,
} from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import type { World } from "../../domain/world";
import type { ActionProvider, ActionRequestConstructionPort } from "../../domain/actions";
import { RequestLease, type RequestLeaseTurn } from "../../domain/request-lease";
import type { ToolGateway } from "../../engine/actions/tool-gateway";
import {
  type SilenceExpression,
  openSilenceExpression,
  silenceExpressionCurrent,
  finishSilenceGesture,
  closeSilenceExpression,
} from "./authority";

/** 原窗口晚查同一表达状态与实际外层阶段；phase是具体请求的原捕获值，不接受context重建。 */
interface ExpressionRequestScope {
  actorId: number;
  phase: Phase;
  expression: SilenceExpression;
  kind: "gesture" | "translation";
  current(): boolean;
}
const requests = RequestLease.window<ExpressionRequestScope>(
  {
    actorId: (s) => s.actorId,
    day: (s) => s.expression.day,
    phase: (s) => s.phase,
    stage: (s) => (s.kind === "gesture" ? "silence_gesture" : "silence_translation"),
    current: (s) => s.current(),
  },
  171,
  [
    "silence_target_id",
    "silence_translator_id",
    "silence_round",
    "silence_gesture_description",
    "action_failure_policy",
    "allow_fallback",
  ],
);

export interface SilenceExpressionRuntime {
  world: World;
  events: GameEvent[];
  requests: ActionRequestConstructionPort;
  provider: ActionProvider;
  gateway: ToolGateway;
  day: number;
  phase: Phase.Day | Phase.Voting;
  isCurrent(): boolean;
}

/** 返回 undefined 表示该原演员无需替换；真正打开窗口时才产生一次异步等待。 */
export function openSilenceSpeech(
  runtime: SilenceExpressionRuntime,
  actorId: number,
  round: SilenceExpressionRound,
): Promise<void> | undefined {
  const expression = openSilenceExpression(runtime.world, runtime.day, actorId, round);
  return expression ? runExpression(runtime, expression) : undefined;
}

async function runExpression(
  r: SilenceExpressionRuntime,
  expression: SilenceExpression,
): Promise<void> {
  let delivery: RequestLeaseTurn | undefined;
  let failed = false;
  const scope = (
    actorId: number,
    kind: ExpressionRequestScope["kind"],
  ): ExpressionRequestScope => ({
    actorId,
    kind,
    expression,
    phase: r.phase,
    current: () => r.isCurrent() && silenceExpressionCurrent(r.world, expression, actorId, kind),
  });
  try {
    const request = r.requests.create({
      actorId: expression.targetId,
      phase: r.phase,
      allowedTools: ["gesture"],
      stage: "silence_gesture",
      requiresAction: true,
      summary: { key: "request.summary.silence_gesture" },
      context: {
        silence_target_id: expression.targetId,
        silence_translator_id: expression.translatorId,
        silence_round: expression.round,
        action_failure_policy: "error",
        allow_fallback: false,
      },
    });
    const gestureScope = scope(expression.targetId, "gesture");
    requests.bind(gestureScope, request);
    delivery = requests.openDelivery(gestureScope, request);
    if (!delivery?.current()) throw new Error("silence_gesture_request_revoked");
    const action = await r.provider.getAction(request);
    if (!delivery.current()) throw new Error("silence_gesture_request_revoked");
    if (action?.name !== "gesture") throw new Error("silence_gesture_missing");
    const result = r.gateway.validateAndSanitize(r.world, expression.targetId, action, {
      phase: r.phase,
      day: expression.day,
    });
    if (!delivery.current()) throw new Error("silence_gesture_request_revoked");
    if (!result.ok || result.sanitizedCall?.name !== "gesture")
      throw new Error("silence_gesture_invalid");
    const description = result.sanitizedCall.args.description;
    const gestureSink = r.events,
      publishGesture = gestureSink.push;
    const gestureEvent: GameEvent = {
      timestamp: Date.now(),
      type: "silence_gesture",
      payload: {
        policy: SILENCE_ELDER_POLICY,
        day: expression.day,
        actorId: expression.targetId,
        round: expression.round,
        description,
      },
    };
    if (!delivery.current()) throw new Error("silence_gesture_request_revoked");
    finishSilenceGesture(r.world, expression);
    Reflect.apply(publishGesture, gestureSink, [gestureEvent]);
    delivery.complete();
    // 译者在手势等待期间死亡／换体时不再请求；从未询问不等于译者明确拒绝。
    const translatorId = expression.translatorId;
    if (
      translatorId === null ||
      !r.isCurrent() ||
      !silenceExpressionCurrent(r.world, expression, translatorId, "translation")
    )
      return;
    const translation = r.requests.create({
      actorId: translatorId,
      phase: r.phase,
      allowedTools: ["translate_silence"],
      stage: "silence_translation",
      requiresAction: true,
      summary: { key: "request.summary.silence_translation" },
      context: {
        silence_target_id: expression.targetId,
        silence_translator_id: translatorId,
        silence_round: expression.round,
        silence_gesture_description: description,
        action_failure_policy: "error",
        allow_fallback: false,
      },
    });
    const translationScope = scope(translatorId, "translation");
    requests.bind(translationScope, translation);
    delivery = requests.openDelivery(translationScope, translation);
    if (!delivery?.current()) throw new Error("silence_translation_request_revoked");
    const interpretation = await r.provider.getAction(translation);
    if (!delivery.current()) throw new Error("silence_translation_request_revoked");
    if (interpretation?.name !== "translate_silence")
      throw new Error("silence_translation_missing");
    const checked = r.gateway.validateAndSanitize(r.world, translatorId, interpretation, {
      phase: r.phase,
      day: expression.day,
    });
    if (!delivery.current()) throw new Error("silence_translation_request_revoked");
    if (!checked.ok || checked.sanitizedCall?.name !== "translate_silence")
      throw new Error("silence_translation_invalid");
    const text = checked.sanitizedCall.args.text;
    const base = {
      policy: SILENCE_ELDER_POLICY,
      day: expression.day,
      actorId: translatorId,
      targetId: expression.targetId,
      round: expression.round,
    };
    const translationSink = r.events,
      publishTranslation = translationSink.push;
    const translationEvent: GameEvent =
      text === null
        ? {
            timestamp: Date.now(),
            type: "silence_translation_declined",
            payload: base,
            audience: Object.freeze([translatorId]),
          }
        : { timestamp: Date.now(), type: "silence_translated", payload: { ...base, text } };
    if (!delivery.current()) throw new Error("silence_translation_request_revoked");
    closeSilenceExpression(expression);
    Reflect.apply(publishTranslation, translationSink, [translationEvent]);
    delivery.complete();
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    closeSilenceExpression(expression);
    try {
      delivery?.close();
    } catch (error) {
      if (!failed) throw error;
    }
  }
}
