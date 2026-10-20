/**
 * 负责有限典狱长板的原生个人目标准入。输入是实际网关宿主，输出额外拒绝或继续原规则。
 * 未安装本族窗口只查WeakMap，不读新配置；团刀、刀票与无主动技能者不参与此政策。
 * 这里不映射目标、不付款，原能力库存、自救及真实刀口仍由原规则验证。
 */
import { Phase, RuleError, type RuleViolation } from "@ai-werewolf-arena/game-contract";
import type { ValidationHostInput } from "../engine/actions/validation-queries";
import { forcedWardenPartner } from "../features/warden/ports";
export function validateWardenNativeTarget(ctx: ValidationHostInput): RuleViolation | null {
  if (
    ctx.phase !== Phase.Night ||
    ctx.day === undefined ||
    !["check_identity", "use_potion", "dream"].includes(ctx.toolCall.name)
  )
    return null;
  const force = forcedWardenPartner(ctx.world, ctx.day, ctx.actorId);
  if (!force) return null;
  const c = ctx.toolCall;
  if (!force.isCurrent()) return { code: RuleError.CustomRuleError };
  if (c.name === "use_potion" && c.args.potion_type === "none") return null;
  return (c.name === "check_identity" || c.name === "use_potion" || c.name === "dream") &&
    c.args.target_id === force.targetId
    ? null
    : { code: RuleError.CustomRuleError };
}
