/**
 * 负责炼金魔女延迟夜蛇选择的原窗口、请求与回复复核。输入为原 World／事件／day pending、当前性与惰性构造依赖；
 * 输出为原疗救目标并发表本职事实，实际库存和窗口写权仍归 frame；请求数据不是原体或行动许可。
 * 不变量：先核 roster／候选并开放蛇窗口，才在原 new 点读构造器；本函数无 finally，失败保原已开窗口前缀，外层经理 abort。
 * Provider 是原唯一 await，随后原名单／状态／gateway 复验成功才提交选择、写事实，不退款或替换异常。
 */
import { Phase, type ActionProvider, type GameEvent } from "../../../../domain/model";
import type { World } from "../../../../domain/world";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import type { ActionRequestFactoryConstructorPort } from "../../../../domain/actions";
import type { MistPendingNight } from "./pending_night";
import {
  assertMistRosterCurrent,
  mistCasterId,
  openSnakeWindow,
  commitSnakeChoice,
} from "./night_frame";

/** 经理已在此前自爆／警徽 await 之前领取同一 pending；本选择窗口不重新 claim 或保存第二份待夜。 */
export async function decideSnake(
  world: World,
  events: GameEvent[],
  gateway: ToolGateway,
  provider: ActionProvider,
  pending: MistPendingNight,
  isCurrent: () => boolean,
  construction: { readonly requestFactory: ActionRequestFactoryConstructorPort },
): Promise<number | null> {
  const actorId = mistCasterId(world, "alchemist"),
    day = pending.day;
  const current = () => pending.status === "committing" && isCurrent();
  if (!current()) throw new Error("snake_window_stale");
  assertMistRosterCurrent(world);
  const candidates = pending.snakeTargets(actorId);
  openSnakeWindow(world, day, candidates, current);
  // 原蛇窗口先开放，再在原点读取构造器并独立 new；构造失败不在此关闭，外层经理原 abort 保留该前缀。
  const request = new construction.requestFactory(world, events, day).create({
    phase: Phase.Day,
    actorId,
    allowedTools: ["use_snake"],
    stage: "alchemist_snake",
    requiresAction: true,
    summary: { key: "request.summary.alchemist_snake" },
    context: {
      snake_target: pending.wolfTarget,
      snake_candidates: candidates,
      action_failure_policy: "error",
      allow_fallback: false,
    },
  });
  const action = await provider.getAction(request);
  assertMistRosterCurrent(world);
  if (!current()) throw new Error("snake_window_stale");
  if (action?.name !== "use_snake") throw new Error("snake_action_missing");
  const result = gateway.validateAndSanitize(world, actorId, action, { phase: Phase.Day, day });
  assertMistRosterCurrent(world);
  if (!current() || !result.ok || result.sanitizedCall?.name !== "use_snake")
    throw new Error("snake_action_invalid");
  const targetId = result.sanitizedCall.args.target_id;
  commitSnakeChoice(world, day, actorId, targetId);
  events.push({
    timestamp: Date.now(),
    type: "alchemist_snake_chosen",
    payload: { actorId, day, targetId },
    audience: Object.freeze([actorId]),
  });
  return targetId;
}
