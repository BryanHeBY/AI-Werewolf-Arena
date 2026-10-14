/**
 * 负责普通查验工具的完整准入组合：活跃实例、阶段、学者／导师削弱、目标与本地历史。
 * 输入为原校验上下文和工具，输出为首个结构化拒绝或 null；不执行查验、付款或授予租约。
 * 状态仍归实际技能库存和历史 owner；受赠／复制／转移实例不因角色标签被重新裁决。
 * 保留参数、目标 getter 与短路失败的原顺序，真实效果提交仍由阶段重新核对生命与 scope。
 */
import { scholarMentorBlocks } from "../game/mechanisms/roles/scholar_mentor/ports";
import { seerTargetAllowed } from "../game/mechanisms/roles/seer/ports";
import { Phase, RuleError } from "@ai-werewolf-arena/game-contract";
import { type ToolRuleMap, isAliveTarget } from "../game/mechanisms/validation/contracts";
import { activeNightAbility } from "../game/mechanisms/roles/abilities";
import { luckyTargetAllowed } from "../game/mechanisms/roles/night_action_history";

/** 同一可写表交给 profile；当前角色晚读 callback，全局回退仍保留 Registry 构造时的原捕获。 */
export const SEER_VALIDATION_RULES: ToolRuleMap = {
  check_identity: ({ world, actorId, role, toolCall, day, abilityId, phase }) => {
    // 按真实库存选择实例，不新增 Seer 角色标签或 native 来源限制。
    const ability = activeNightAbility(role, "seer_check", day ?? 1, abilityId);
    if (!ability) return { code: RuleError.SeerOnly };
    if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
    if (toolCall.name !== "check_identity") return { code: RuleError.ToolMismatch };
    // 削弱查询先于目标；未 settled 等原 frame 错误继续传播，不补读后续字段。
    if (scholarMentorBlocks(world, day ?? 1, actorId, "check"))
      return { code: RuleError.ModifierUnavailable };
    // 三处 target_id 在原调用点分别读取；终身目标政策与行动者本地历史不合并或重置。
    if (!isAliveTarget(world, toolCall.args.target_id)) return { code: RuleError.CheckTarget };
    if (!seerTargetAllowed(ability.state, actorId, toolCall.args.target_id))
      return { code: RuleError.SeerTargetPolicy };
    if (
      !luckyTargetAllowed(world, actorId, ability, day ?? 1, "check", toolCall.args.target_id)
    )
      return { code: RuleError.LuckyTargetRepeat };
    return null;
  },
};
