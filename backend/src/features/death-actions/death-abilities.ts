/**
 * 负责赠枪的公开查询／生命周期入口、玩家投影及工具枪权政策装配。
 * 输入为原实例或 gateway 校验上下文；输出保留真实函数引用、裁剪后的玩家 DTO 与拒绝代码。
 * 实例生命周期和原体证明归 death-gun-lifecycle，玩家投影归 player_state，公共类型归 game-contract。
 * 本入口仅在原参数位置查询枪权；不修改库存、标记死亡、复制运行时授权或执行录制 I/O。
 */
import { RuleError } from "@ai-werewolf-arena/game-contract";
import type { ValidationRuleContext } from "../../engine/actions/validation-contracts";
import { validateDeathShot } from "./death-shot";
import { activeDeathGun } from "./death-gun-lifecycle";
export {
  allDeathGuns,
  findDeathGun,
  deathGunOwnerCurrent,
  grantDeathGun,
  armDeathGun,
  activeDeathGun,
  captureDeathGun,
  firstDeathGuns,
  finishDeathGuns,
  setDeathGunEnabled,
  transferDeathGun,
  consumeDeathGunShot,
} from "./death-gun-lifecycle";
export { projectDeathGun } from "../../agents/observation/player-state";

export function copyDeathGun(): never {
  throw new Error("death_ability_copy_not_supported");
}

export function validateGiftGun(ctx: ValidationRuleContext) {
  if (!ctx.abilityId || ctx.day === undefined) return { code: RuleError.ShootUnavailable };
  return validateDeathShot(
    ctx,
    !!activeDeathGun(ctx.world, ctx.actorId, ctx.abilityId, ctx.day, true),
  );
}

/** 完整资格组合的实际公开 owner；不包装调用或改变原赠枪工具校验。 */
export { captureDeathShotEligibility } from "./death-shot-eligibility";
export type { DeathShotEligibility } from "./death-shot-eligibility";
