import { ToolRepairPack } from "../../llm/contracts";
import { extractTargetId, numberOrNull, pickAliveNotSelf } from "../../llm/helpers";

export const HUNTER_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    shoot: (args) => {
      const target = numberOrNull(args.target_id);
      if (target === null) {
        return null;
      }
      return { target_id: target };
    },
  },
  recover: {
    shoot: (text, ctx) => {
      const targetId = extractTargetId(text, ctx.actorId);
      const resolvedTarget = targetId ?? pickAliveNotSelf(ctx.world, ctx.actorId);
      if (resolvedTarget === null) {
        return null;
      }
      return {
        name: "shoot",
        args: { target_id: resolvedTarget },
      };
    },
  },
};
