/** 文件说明：预言家工具调用的 LLM 修复策略。 */
import { ToolRepairPack } from "../../llm/contracts";
import { extractTargetId, numberOrNull, pickAliveNotSelf } from "../../llm/helpers";

/** 预言家角色 LLM 修复包。 */
export const SEER_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    check_identity: (args) => {
      const target = numberOrNull(args.target_id);
      if (target === null) {
        return null;
      }
      return { target_id: target };
    },
  },
  recover: {
    check_identity: (text, ctx) => {
      const targetId = extractTargetId(text, ctx.actorId);
      const resolvedTarget = targetId ?? pickAliveNotSelf(ctx.world, ctx.actorId);
      if (resolvedTarget === null) {
        return null;
      }
      return {
        name: "check_identity",
        args: { target_id: resolvedTarget },
      };
    },
  },
};
