/**
 * 负责有限猎魔人原猎杀回合的请求、回复复验和选择交付。输入为原 World、事件、夜号与惰性构造依赖；
 * 输出原选择事实，生命／库存／付款归 authority；请求绑定先于等待，回复后按原次序复验并提交。
 * 原 turn 开启后才在 try 内读取工厂类，失败保已发生前缀并关闭原许可，不重试或补交选择。
 */
import {
  Phase,
  type World,
  type GameEvent,
  type ActionProvider,
  type ActionStage,
  type ToolName,
  type ToolCall,
} from "../../../../core";
import { safeRecordLogicOp } from "../../../../recording/session_recorder";
import type { ActionRequestFactoryConstructorPort } from "../../../../core/domain/actions";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import { DEMON_HUNTER_POLICY, readDemonHuntTool } from "./state";
import {
  demonHunterActorId,
  openDemonHunterTurn,
  closeDemonHunterTurn,
  bindDemonHunterRequest,
  authorizedDemonHunter,
  canSubmitDemonHunt,
  commitDemonHunt,
} from "./authority";
export interface DemonHunterChoiceFact {
  readonly policy: typeof DEMON_HUNTER_POLICY;
  readonly actorId: number;
  readonly day: number;
  readonly targetId: number | null;
}
/** 原有限猎魔人行动；具体原体／夜许可仍由 authority 复验，构造依赖不是选择或付款许可。 */
export async function executeDemonHunterTurn(input: {
  world: World;
  gateway: ToolGateway;
  events: GameEvent[];
  provider: ActionProvider;
  day: number;
  /** 原 new 点晚读构造器；不会复用阶段工厂或据依赖授予猎杀许可。 */
  construction: { readonly requestFactory: ActionRequestFactoryConstructorPort };
}): Promise<Readonly<DemonHunterChoiceFact>> {
  const { world, gateway, events, provider, day } = input,
    actorId = demonHunterActorId(world);
  if (actorId === null) throw new Error("demon_hunter_actor_unavailable");
  const scope = openDemonHunterTurn(world);
  try {
    // 原 turn 已开且位于 try 内；构造读取或 create 失败仍由原 finally 关闭许可。
    const request = new input.construction.requestFactory(world, events, day).create({
      phase: Phase.Night,
      actorId,
      allowedTools: ["demon_hunt" as ToolName],
      stage: "demon_hunter" as ActionStage,
      requiresAction: true,
      summary: { key: "request.summary.night_action" },
      context: { allow_fallback: false, action_failure_policy: "error" },
    });
    bindDemonHunterRequest(world, request);
    if (!authorizedDemonHunter(world, actorId, Phase.Night, day, scope))
      throw new Error("demon_hunter_turn_revoked");
    const raw = await provider.getAction(request);
    if (!authorizedDemonHunter(world, actorId, Phase.Night, day, scope))
      throw new Error("demon_hunter_turn_revoked");
    const call = readDemonHuntTool(raw);
    if (!call || !canSubmitDemonHunt(world, actorId, Phase.Night, day, scope, call))
      throw new Error("demon_hunter_required_action_invalid");
    const valid = gateway.validateAndSanitize(world, actorId, call as unknown as ToolCall, {
      phase: Phase.Night,
      day,
      demonHunterScope: scope,
      deferOperation: true,
    });
    if (!valid.ok || !valid.sanitizedCall) throw new Error("demon_hunter_action_invalid");
    const choice = commitDemonHunt(world, scope, call);
    if (!choice) throw new Error("demon_hunter_action_commit_failed");
    safeRecordLogicOp({
      scope: "gateway",
      op: "validate_tool_call",
      actorId,
      phase: Phase.Night,
      status: "ok",
      input: { tool: call.name, args: call.args },
    });
    return Object.freeze({
      policy: DEMON_HUNTER_POLICY,
      actorId,
      day: choice.day,
      targetId: choice.targetId,
    });
  } finally {
    closeDemonHunterTurn(scope);
  }
}
