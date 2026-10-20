/**
 * 负责Warden强制个人技能的真实请求交付，仅命中已付双背叛时使用。
 * 输入为原请求与原能力/partner晚guard，输出同租约；未配置旧夜阶段不读取此scope或新增字段。
 * 库存仍归Seer/Witch/Dream原owner，窗口只控制期限与完成，不替代付款或重建技能。
 */
import { Phase, type ActionRequest } from "@ai-werewolf-arena/game-contract";
import { RequestLease } from "../../domain/request-lease";
interface NativeScope {
  actorId: number;
  day: number;
  stage: "witch" | "dreamer";
  current(): boolean;
}
const requests = RequestLease.window<NativeScope>(
  {
    actorId: (s) => s.actorId,
    day: (s) => s.day,
    phase: () => Phase.Night,
    stage: (s) => s.stage,
    current: (s) => s.current(),
  },
  192,
  ["warden_forced_target", "ability_id", "action_failure_policy", "allow_fallback"],
);
export function openWardenNativeDelivery(request: ActionRequest, current: () => boolean) {
  if (request.context.stage !== "witch" && request.context.stage !== "dreamer")
    throw new Error("warden_native_stage_invalid");
  const scope: NativeScope = {
    actorId: request.actorId,
    day: request.context.day,
    stage: request.context.stage,
    current,
  };
  requests.bind(scope, request);
  const delivery = requests.openDelivery(scope, request);
  if (!delivery) throw new Error("warden_native_delivery_revoked");
  return delivery;
}
