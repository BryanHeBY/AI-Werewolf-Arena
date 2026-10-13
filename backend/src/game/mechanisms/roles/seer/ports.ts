/**
 * 负责预言家公开的终身查验去重与自身目标查询，供提示、预检和阶段重查调用。
 * 输入是只读预言家状态及行动者、目标序号；输出保留原历史去重和自身目标规则。
 * 每次查询之前，原字段读取失败继续传播；权限与失败、关闭窗口由既有租约所有者负责。
 * 公开 getter 返回同一深只读状态引用；初始化具名绑定保留原输入复制契约。
 * 本入口不重置回合、不捕获行动权限，也不提交查验或修改库存。
 */

import type { SeerReadState } from "@ai-werewolf-arena/game-contract";

export { getSeerState } from "./state";

export function seerTargetAllowed(
  state: SeerReadState | undefined,
  actorId: number,
  targetId: number,
): boolean {
  return (
    state?.targetPolicy !== "awa_fresh_others_v1" ||
    (targetId !== actorId && !state.history.some((row) => row.targetId === targetId))
  );
}

export { setSeerState } from "./state";
