/**
 * 负责把真实 Identity 座位与已解析模型名投影成 God 回放展示资料。输入为当前 World、玩家编号及可选模型；
 * 输出仅含 seat/model 白名单，不复制 Agent 配置或查询私有 Tape；昵称、角色与阵营仍由原名单 owner 负责。
 */
import { isReplayModelLabel } from "@ai-werewolf-arena/replay-contract";
import { COMPONENT } from "../domain/components/names";
import type { World } from "../domain/world";

export function replayPlayerDisplay(
  world: World,
  id: number,
  model?: string,
): { seat?: number; model?: string } {
  const seat = world.getComponent(id, COMPONENT.Identity)?.seat;
  return {
    ...(Number.isSafeInteger(seat) && Number(seat) > 0 ? { seat } : {}),
    ...(isReplayModelLabel(model) ? { model } : {}),
  };
}
