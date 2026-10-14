/**
 * 负责定序王子在原首轮票之后的重收票选择与必需发言。输入为原 World、日次、请求构造端口及 Provider；
 * 输出原是否重收票的结果和事实，放逐目标与 PK 仍由投票流水线拥有。
 * 每个等待后保留原当前性复验；选择提交先于发言，后续失败不回滚已提交前缀，finally 仍关闭本族窗口。
 * 构造端口不授予行动或资源权限，也不绕过网关及原体检查。
 */
import type { ActionProvider, GameEvent } from "../../../../core/domain/model";
import { Phase } from "../../../../core/domain/identity";
import type { World } from "../../../../core/domain/world";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import type { ActionRequestConstructionPort } from "../../../../core/domain/actions";
import {
  openOrderPrinceChoice,
  assertOrderPrinceCurrent,
  commitOrderPrinceChoice,
  closeOrderPrinceChoice,
} from "./authority";

/** 只在原首轮票之后、任何放逐或 PK 效果之前调用，重收票仍归同一投票流水线。 */
export async function runOrderPrinceChoice(
  world: World,
  requests: ActionRequestConstructionPort,
  provider: ActionProvider,
  gateway: ToolGateway,
  events: GameEvent[],
  day: number,
  isCurrent: () => boolean,
): Promise<boolean> {
  const actorId = openOrderPrinceChoice(world, day);
  if (actorId === null) return false;
  const current = () => {
    assertOrderPrinceCurrent(world, actorId);
    if (!isCurrent()) throw new Error("order_prince_choice_stale");
  };
  try {
    current();
    const choice = await provider.getAction(
      requests.create({
        phase: Phase.Voting,
        actorId,
        allowedTools: ["reset_exile_vote"],
        stage: "order_prince_choice",
        requiresAction: true,
        summary: { key: "request.summary.order_prince_choice" },
        context: { action_failure_policy: "error", allow_fallback: false },
      }),
    );
    current();
    if (choice?.name !== "reset_exile_vote") throw new Error("order_prince_choice_missing");
    const checked = gateway.validateAndSanitize(world, actorId, choice, {
      phase: Phase.Voting,
      day,
    });
    current();
    if (!checked.ok || checked.sanitizedCall?.name !== "reset_exile_vote")
      throw new Error("order_prince_choice_invalid");
    const activate = checked.sanitizedCall.args.activate;
    commitOrderPrinceChoice(world, actorId, day, activate);
    events.push({
      timestamp: Date.now(),
      type: "order_prince_choice_committed",
      payload: { actorId, day, activate },
      audience: Object.freeze([actorId]),
    });
    if (!activate) return false;
    events.push({
      timestamp: Date.now(),
      type: "order_prince_revote_started",
      payload: { actorId },
    });
    current();
    const speech = await provider.getAction(
      requests.create({
        phase: Phase.Voting,
        actorId,
        allowedTools: ["speak"],
        stage: "order_prince_speech",
        requiresAction: true,
        summary: { key: "request.summary.order_prince_speech" },
        context: { action_failure_policy: "error", allow_fallback: false },
      }),
    );
    current();
    if (speech?.name !== "speak") throw new Error("order_prince_speech_missing");
    const validated = gateway.validateAndSanitize(world, actorId, speech, {
      phase: Phase.Voting,
      day,
    });
    current();
    if (!validated.ok || validated.sanitizedCall?.name !== "speak")
      throw new Error("order_prince_speech_invalid");
    events.push({
      timestamp: Date.now(),
      type: "day_speech",
      payload: { actorId, text: validated.sanitizedCall.args.text },
    });
    return true;
  } finally {
    closeOrderPrinceChoice(world);
  }
}
