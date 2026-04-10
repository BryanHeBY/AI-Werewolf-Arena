import { ToolRepairPack } from "../../llm/contracts";
import { extractTargetId, numberOrNull, pickAliveNotSelf } from "../../llm/helpers";

export const GUARD_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    guard: (args) => {
      const abstain = Boolean(args.abstain);
      if (abstain) {
        return { target_id: null, abstain: true };
      }
      const target = numberOrNull(args.target_id);
      if (target === null) {
        return null;
      }
      return { target_id: target, abstain: false };
    },
  },
  recover: {
    guard: (text, ctx) => {
      const lower = text.toLowerCase();
      const abstain =
        lower.includes("空守") ||
        lower.includes("不守") ||
        lower.includes("abstain");
      if (abstain) {
        return {
          name: "guard",
          args: { target_id: null, abstain: true },
        };
      }
      const targetId = extractTargetId(text, ctx.actorId);
      const resolvedTarget = targetId ?? pickAliveNotSelf(ctx.world, ctx.actorId);
      if (resolvedTarget === null) {
        return {
          name: "guard",
          args: { target_id: null, abstain: true },
        };
      }
      return {
        name: "guard",
        args: { target_id: resolvedTarget, abstain: false },
      };
    },
  },
};
