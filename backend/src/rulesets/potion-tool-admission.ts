/**
 * 负责普通用药工具的完整准入组合：能力／库存、自救、学者／导师削弱、目标映射与受赠目标限制。
 * 输入为原校验上下文和已清洗工具，输出为原首个结构化拒绝或通过；不执行用药或付款。
 * 读取同一实例和当前 settled frame，不因角色标签限定受赠／复制／转移能力，不建立库存快照。
 * 参数、短路及 getter 失败顺序保持；预检通过不替代实际提交时的原体、生命和来源复验。
 */
import { scholarMentorBlocks } from "../game/mechanisms/roles/scholar_mentor/ports";
import { isMagicianBoard, resolveMagicianNightTarget } from "../game/mechanisms/roles/magician/ports";
import { nativePotionsCanCombine } from "../game/mechanisms/roles/witch/ports";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { PotionType, Phase, WitchSelfHealRule, StatusMark } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../domain/components/names";
import { type ToolRuleMap, isAliveTarget } from "../game/mechanisms/validation/contracts";
import { activeNightAbility } from "../game/mechanisms/roles/abilities";
import { luckyTargetAllowed } from "../game/mechanisms/roles/night_action_history";

/** 保留原可写规则表；Catalog 仍晚读当前 callback，不把准入冻结为登记时的授权快照。 */
export const WITCH_VALIDATION_RULES: ToolRuleMap = {
  use_potion: ({ world, actorId, role, toolCall, day, abilityId, phase }) => {
    // 原库存选择也适用于受赠／复制／转移药剂；不新增 Witch 角色标签门槛。
    const ability = activeNightAbility(role, "potion", day ?? 1, abilityId);
    const witchState = ability?.state;
    if (!witchState) {
      return { code: RuleError.WitchOnly };
    }
    if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
    if (toolCall.name !== "use_potion") {
      return { code: RuleError.ToolMismatch };
    }
    if (
      ability?.activation === "lucky" &&
      toolCall.args.potion_type === PotionType.None &&
      toolCall.args.target_id !== actorId
    )
      return { code: RuleError.PoisonTarget };
    if (
      ability?.activation === "black_market" &&
      toolCall.args.potion_type === PotionType.None &&
      !isAliveTarget(world, toolCall.args.target_id)
    )
      return { code: RuleError.PoisonTarget };
    if (toolCall.args.potion_type === PotionType.Heal) {
      const canSelfHeal =
        day === undefined
          ? witchState.canSelfHeal
          : witchState.selfHealRule === WitchSelfHealRule.Always ||
            (witchState.selfHealRule === WitchSelfHealRule.FirstNightOnly && day === 1);
      if (!canSelfHeal && toolCall.args.target_id === actorId) {
        return { code: RuleError.SelfHeal };
      }
      if (witchState.heal <= 0 || witchState.healUsedThisNight) {
        return { code: RuleError.HealUnavailable };
      }
      if (witchState.poisonUsedThisNight && !nativePotionsCanCombine(ability!)) {
        return { code: RuleError.TwoPotions };
      }
      const requestedId = toolCall.args.target_id;
      if (!isAliveTarget(world, requestedId)) return { code: RuleError.HealTarget };
      // 自救先检查请求编号；这里才映射有效目标，缺失 day 的原默认是 0 而非库存查询的 1。
      const mapping = isMagicianBoard(world)
        ? resolveMagicianNightTarget(world, day ?? 0, requestedId)
        : null;
      if (mapping && !mapping.isCurrent()) return { code: RuleError.HealTarget };
      const targetId = mapping?.effectiveId ?? requestedId;
      if (
        !isAliveTarget(world, targetId) ||
        !world.getComponent(targetId, COMPONENT.Role) ||
        !world.getComponent(targetId, COMPONENT.StatusMarks)?.has(StatusMark.WolfKillMark)
      ) {
        return { code: RuleError.HealTarget };
      }
      return null;
    }
    if (toolCall.args.potion_type === PotionType.Poison) {
      // 削弱查询先于瓶数／目标；原 frame 错误原样传播，不转成库存不足或补读目标。
      if (scholarMentorBlocks(world, day ?? 1, actorId, "poison"))
        return { code: RuleError.ModifierUnavailable };
      if (witchState.poison <= 0 || witchState.poisonUsedThisNight) {
        return { code: RuleError.PoisonUnavailable };
      }
      if (witchState.healUsedThisNight && !nativePotionsCanCombine(ability!)) {
        return { code: RuleError.TwoPotions };
      }
      if (!isAliveTarget(world, toolCall.args.target_id)) {
        return { code: RuleError.PoisonTarget };
      }
      if (
        !luckyTargetAllowed(world, actorId, ability!, day ?? 1, "poison", toolCall.args.target_id)
      )
        return { code: RuleError.LuckyTargetRepeat };
      return null;
    }
    return null;
  },
};
