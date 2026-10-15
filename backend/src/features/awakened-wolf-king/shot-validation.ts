/**
 * 负责按狼爪原 owner 校验具名 shoot 来源；输入为可信宿主上下文，输出“不属本族”或原工具拒绝。
 * 不根据角色名或 ability 字符串授枪，不打开许可、不扣库存；World 的真实死亡许可先由公共 validator 检查。
 */
import { Camp, RuleError } from "@ai-werewolf-arena/game-contract";
import type { ValidationHostInput } from "../../engine/actions/validation-queries";
import { COMPONENT } from "../../domain/components/names";
import { validateDeathShot } from "../death-actions/tool-ports";
import { ownedAwakenedClaws } from "./state";

export function validateAwakenedClawShot(ctx: ValidationHostInput) {
  if (!ctx.abilityId?.startsWith("awakened_claw:")) return undefined;
  const state = ownedAwakenedClaws(ctx.world, ctx.actorId);
  if (
    !state ||
    ctx.world.getComponent(ctx.actorId, COMPONENT.Camp)?.camp !== Camp.Wolf ||
    !state.units.some((unit) => unit.id === ctx.abilityId && unit.status === "ready")
  )
    return { code: RuleError.ShootUnavailable };
  return validateDeathShot(ctx, true);
}
