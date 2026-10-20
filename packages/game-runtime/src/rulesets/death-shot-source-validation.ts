/**
 * 负责按真实来源组合死亡枪预检。输入为同一可信上下文，先咨询狼爪 owner，再在原调用点执行既有好人赠枪。
 * 这里只路由具名能力来源，不依据 Role 分支、复制库存、吞异常或赋予未知 ability 权限。
 * 输出为原能力拒绝或合法空结果，既有赠枪异常及付款顺序保持在原所有者。
 */
import type { ValidationHostInput } from "../engine/actions/validation-queries";
import { validateAwakenedClawShot } from "../features/awakened-wolf-king/shot-validation";
import { validateGiftGun } from "../features/death-actions/gift-gun-ports";

export function validateDeathShotSource(ctx: ValidationHostInput) {
  const claw = validateAwakenedClawShot(ctx);
  return claw === undefined ? validateGiftGun(ctx) : claw;
}
