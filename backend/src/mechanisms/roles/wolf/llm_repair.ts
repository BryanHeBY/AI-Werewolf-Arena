/** 文件说明：狼人工具调用的 LLM 修复策略。 */
import { ToolRepairPack } from "../../llm/contracts";
import { extractTargetId, numberOrNull, pickAliveNotSelf } from "../../llm/helpers";

/** 狼人角色 LLM 修复包。 */
export const WOLF_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    speak_to_wolves: (args) => ({
      text: String(args.text ?? ""),
      end_chat: Boolean(args.end_chat),
    }),
    kill_vote: (args) => {
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
    self_destruct: (args) => ({ reason: String(args.reason ?? "self_destruct") }),
  },
  recover: {
    speak_to_wolves: (text, ctx) => {
      const lower = text.toLowerCase();
      const shouldEndChat =
        lower.includes("结束夜聊") ||
        lower.includes("结束群聊") ||
        lower.includes("停止夜聊") ||
        lower.includes("end_chat");
      return {
        name: "speak_to_wolves",
        args: {
          text: ctx.toSpeakText(text),
          end_chat: shouldEndChat,
        },
      };
    },
    // 自爆属于高风险低频动作：禁止从自然语言恢复，避免误触发。
    self_destruct: () => null,
    kill_vote: (text, ctx) => {
      const lower = text.toLowerCase();
      const abstain =
        lower.includes("不刀") ||
        lower.includes("弃刀") ||
        lower.includes("不投刀") ||
        lower.includes("abstain");
      if (abstain) {
        return {
          name: "kill_vote",
          args: { target_id: null, abstain: true },
        };
      }
      const targetId = extractTargetId(text, ctx.actorId);
      const resolvedTarget = targetId ?? pickAliveNotSelf(ctx.world, ctx.actorId);
      if (resolvedTarget === null) {
        return {
          name: "kill_vote",
          args: { target_id: null, abstain: true },
        };
      }
      return {
        name: "kill_vote",
        args: { target_id: resolvedTarget, abstain: false },
      };
    },
  },
};
