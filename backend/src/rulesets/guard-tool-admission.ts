/**
 * 负责普通守护工具的完整准入组合：实际能力、阶段、学者／导师削弱、重复目标、生命及幸运历史。
 * 输入为原工具校验上下文；输出首个原拒绝码或 null。获赠库存按实际实例判断，不加守卫角色标签。
 * 削弱查询早于空守和目标，四次 target_id 读取保原时点；本模块不提交印记、历史或付款，也不授予请求租约。
 * 规则表保持原可写形态，Registry 的当前角色查询和构造时回退捕获仍归原注册器。
 */
import { scholarMentorBlocks } from "../game/mechanisms/roles/scholar_mentor/ports";
import { guardTargetRepeated } from "../game/mechanisms/roles/guard/ports";
import { Phase, RuleError } from "@ai-werewolf-arena/game-contract";
import { type ToolRuleMap, isAliveTarget } from "../game/mechanisms/validation/contracts";
import { activeNightAbility } from "../game/mechanisms/roles/abilities";
import { luckyTargetAllowed } from "../game/mechanisms/roles/night_action_history";

/** 原表只由 profile 装配，不冻结或重新绑定其中 callback；准入成功仍须阶段在付款前复验。 */
export const GUARD_VALIDATION_RULES: ToolRuleMap = {
      guard: ({ world, actorId, role, toolCall, day, abilityId, phase }) => {
        const ability = activeNightAbility(role, "guard", day ?? 1, abilityId);
        if (!ability) return { code: RuleError.GuardOnly };
        if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
        if (toolCall.name !== "guard") return { code: RuleError.ToolMismatch };
        // 原削弱查询可抛尚未结算错误；即使准备空守也必须先经过它。
        if (scholarMentorBlocks(world, day ?? 1, actorId, "guard"))
          return { code: RuleError.ModifierUnavailable };
        if (toolCall.args.abstain) return null;
        // null／重复／存活／幸运参数分别晚读目标，不缓存或把后续失败转为首拒绝。
        if (toolCall.args.target_id === null) return { code: RuleError.GuardTarget };
        if (guardTargetRepeated(ability, day ?? 1, toolCall.args.target_id))
          return { code: RuleError.GuardRepeat };
        if (!isAliveTarget(world, toolCall.args.target_id)) return { code: RuleError.GuardTarget };
        if (
          !luckyTargetAllowed(world, actorId, ability, day ?? 1, "guard", toolCall.args.target_id)
        )
          return { code: RuleError.LuckyTargetRepeat };
        return null;
      },
    };
