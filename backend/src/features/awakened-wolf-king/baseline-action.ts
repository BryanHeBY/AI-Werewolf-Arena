/**
 * 负责特权基线对原爪能力的选择；输入为原 World／请求和已有选人函数，输出本族动作或不适用。
 * 只选择、不付款；具名 ability_id 不等于夜间赠礼，合法性仍由真实死亡许可与源 owner 复验。
 */
import type { ActionRequest } from "../../domain/actions";
import type { ToolCall } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../domain/world";
import { ownedAwakenedClaws } from "./state";
export function awakenedClawBaseline(
  world: World,
  request: ActionRequest,
  pick: () => number | null,
): ToolCall | null | undefined {
  const abilityId = request.context.ability_id;
  if (!abilityId?.startsWith("awakened_claw:")) return undefined;
  const unit = ownedAwakenedClaws(world, request.actorId)?.units.find(
    (u) => u.id === abilityId && u.status === "ready",
  );
  if (
    !unit ||
    !request.allowedTools.includes("shoot") ||
    request.context.death_action_id === undefined ||
    !world.isDeathActionOpen(request.actorId, "shoot", request.context.death_action_id, abilityId)
  )
    return null;
  const target = pick();
  return {
    name: "shoot",
    args: {
      target_id:
        target !== null && request.context.shoot_candidates?.includes(target)
          ? target
          : (request.context.shoot_candidates?.[0] ?? null),
    },
  };
}
