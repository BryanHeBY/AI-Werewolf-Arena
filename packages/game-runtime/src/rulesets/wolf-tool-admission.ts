/**
 * 负责普通狼狼聊、狼刀和自爆的完整工具准入组合，供共享普通狼装配及派生角色引用。
 * 输入为当前角色运行政策、原 World、阶段／窗口和工具上下文；输出为原首个拒绝或 null。
 * 婚礼狼刀先由鬼魂新娘原权威复验，否则依次检查狼队刀权、阶段、工具、pass 与只读目标贡献。
 * 同一可写规则表保留 callback 引用；派生展开与晚读取仍发生在原 profile／Registry 调用点。
 * 准入不执行工具、付款、开启窗口或授予租约；候选允许结果不能代替真正提交时的权限复验。
 */
import { GHOST_BRIDE_VALIDATION_SCOPE } from "./action-validation-assembly";
import { ownedToolRules } from "../engine/actions/validation-queries";

import { canRoleSelfDestruct } from "../features/self-destruct/capability";
import { bindWolfKnifeTargetQuery } from "../features/wolf/ports";
import {
  weddingMember,
  weddingSetup,
  ghostBrideReady,
  canSubmitWeddingTool,
} from "../features/ghost-bride/ports";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { ActionWindow, Phase } from "../domain/model";
import type { ToolRuleMap } from "../engine/actions/validation-contracts";
import { wolfTeamPermissions } from "../features/wolf-team/permissions";
import { COMPONENT } from "../domain/components/names";

/** 三工具保原首失败顺序；actorId仅在原Camp读取点的source内取得，常量能力不新增查询。 */
export const WOLF_VALIDATION_RULES: ToolRuleMap = ownedToolRules(
  {
    speak_to_wolves: (ctx) => {
      const { world, role, roleCatalog, phase } = ctx;
      if (
        !wolfTeamPermissions(
          role,
          roleCatalog,
          () => world.getComponent(ctx.actorId, COMPONENT.Camp),
          world,
        ).canChat
      ) {
        return { code: RuleError.WolfChatPermission };
      }
      if (phase !== Phase.Night) return { code: RuleError.WolfChatPhase };
      return null;
    },
    kill_vote: ({
      world,
      actorId,
      day,
      scope: ghostBrideScope,
      role,
      roleCatalog,
      toolCall,
      phase,
    }) => {
      // 婚礼分支优先；缺省日次仍为 0，不继续读取普通狼队政策或候选。
      if (weddingSetup(world))
        return canSubmitWeddingTool(world, actorId, phase, day ?? 0, ghostBrideScope, toolCall)
          ? null
          : { code: RuleError.GhostBrideUnavailable };
      if (
        !wolfTeamPermissions(
          role,
          roleCatalog,
          () => world.getComponent(actorId, COMPONENT.Camp),
          world,
        ).canVoteForKill
      ) {
        return { code: RuleError.WolfKillPermission };
      }
      if (phase !== Phase.Night) return { code: RuleError.WolfKillPhase };
      if (toolCall.name !== "kill_vote") {
        return { code: RuleError.ToolMismatch };
      }
      // 原 pass 先于目标查询；非 pass 且首个目标非 null 时，保留三次 args 与两次 target_id 的现场读取。
      if (toolCall.args.abstain) {
        return null;
      }
      if (
        toolCall.args.target_id === null ||
        !bindWolfKnifeTargetQuery(world).allows(toolCall.args.target_id)
      ) {
        return { code: RuleError.KillTarget };
      }
      return null;
    },
    self_destruct: (ctx) => {
      const { world, role, roleCatalog, phase, actionWindow, allowSelfDestruct, toolCall } = ctx;
      // 原婚礼成员排除先于角色自爆能力；阶段与窗口关系通过后检查已取出的 allowSelfDestruct，再读工具名／confirm。
      if (weddingSetup(world) && (!ghostBrideReady(world) || weddingMember(world, role)))
        return { code: RuleError.WolfBlastOnly };
      if (
        !canRoleSelfDestruct(
          role,
          roleCatalog,
          () => world.getComponent(ctx.actorId, COMPONENT.Camp),
          world,
        )
      ) {
        return { code: RuleError.WolfBlastOnly };
      }
      if (phase !== Phase.Day && phase !== Phase.Voting) {
        return { code: RuleError.BlastPhase };
      }
      if (actionWindow === undefined || !Object.values(ActionWindow).includes(actionWindow)) {
        return { code: RuleError.BlastWindow };
      }
      if (phase !== (actionWindow === ActionWindow.OnPreVote ? Phase.Voting : Phase.Day))
        return { code: RuleError.BlastPhase };
      if (!allowSelfDestruct) {
        return { code: RuleError.BlastDisabled };
      }
      if (toolCall.name !== "self_destruct" || toolCall.args.confirm !== true) {
        return { code: RuleError.BlastConfirm };
      }
      return null;
    },
  },
  GHOST_BRIDE_VALIDATION_SCOPE,
);
