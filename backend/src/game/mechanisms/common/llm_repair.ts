/** 文件说明：定义通用工具的 LLM 参数修复与文本恢复策略。 */
import { ToolRepairPack } from "../llm/contracts";
import { numberOrNull, extractTargetId, pickAliveNotSelf } from "../llm/helpers";

/** 通用工具 LLM 修复包。 */
export const COMMON_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    speak: (args) => ({ text: String(args.text ?? "") }),
    vote: (args) => {
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
    speak: (text, ctx) => ({
      name: "speak",
      args: {
        text: ctx.toSpeakText(text),
      },
    }),
    vote: (text, ctx) => {
      const lower = text.toLowerCase();
      const abstain =
        lower.includes("弃票") ||
        lower.includes("不投票") ||
        lower.includes("abstain");
      if (abstain) {
        return {
          name: "vote",
          args: { target_id: null, abstain: true },
        };
      }
      const targetId = extractTargetId(text, ctx.actorId);
      const resolvedTarget = targetId ?? pickAliveNotSelf(ctx.world, ctx.actorId);
      if (resolvedTarget === null) {
        return {
          name: "vote",
          args: { target_id: null, abstain: true },
        };
      }
      return {
        name: "vote",
        args: { target_id: resolvedTarget, abstain: false },
      };
    },
  },
};
