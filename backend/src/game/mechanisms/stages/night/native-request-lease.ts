/**
 * 负责普通原生夜请求的运行绑定与一次完成通知，输入为捕获演员、日次、阶段、能力标识及晚领域查询。
 * 输出为本次交付句柄或拒绝；只有既有 RequestLease 保存绑定／别名／最早期限，不持第二份 Map，也不修改 World 或库存。
 * ability_id 初次关联及后续 pin 是明确新增的 F02 输入约束，不把相同请求字段当作领域许可。
 * Provider 返回只是候选；实际窗口必须完成其全部领域写入后调用 complete，退出时 close 只通知未完成。
 */
import type { ActionRequest } from "@ai-werewolf-arena/game-contract/requests";
import type { ActionStage } from "@ai-werewolf-arena/game-contract/actions";
import { Phase } from "@ai-werewolf-arena/game-contract";
import { RequestLease, type RequestLeaseTurn } from "../../../../domain/request-lease";

/** 每个真实请求独立的运行输入；current 保留领域查询 receiver，不能由请求 DTO 重建。 */
export interface NativeNightRequestScope {
  readonly actorId: number;
  readonly day: number;
  readonly stage: ActionStage;
  readonly abilityId: string;
  current(): boolean;
}

// 传播顺序接在现有首夜／遗言窗口之后；这里只 pin 顶层 ability_id 原值，不深复制 context。
const nativeNightRequests = RequestLease.window<NativeNightRequestScope>({
  actorId: (scope) => scope.actorId,
  phase: () => Phase.Night,
  day: (scope) => scope.day,
  stage: (scope) => scope.stage,
  current: (scope) => scope.current(),
}, 140, ["ability_id"]);

/** 编号初次关联不另查 World／Camp；开窗当前性仍委托原 scope，不建第二许可。 */
export function openNativeNightRequestDelivery(
  scope: NativeNightRequestScope,
  request: ActionRequest,
): RequestLeaseTurn | undefined {
  if (request.context.ability_id !== scope.abilityId) return;
  nativeNightRequests.bind(scope, request);
  return nativeNightRequests.openDelivery(scope, request);
}
