/** 文件说明：狼人原生工具参数纠正规则。 */
import { ToolRepairPack } from "../../llm/contracts";
import { numberOrNull } from "../../llm/helpers";

export const WOLF_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    speak_to_wolves: (args) => ({ text: String(args.text ?? ""), end_chat: Boolean(args.end_chat) }),
    kill_vote: (args) => {
      const abstain = Boolean(args.abstain);
      if (abstain) return { target_id: null, abstain: true };
      const target = numberOrNull(args.target_id);
      return target === null ? null : { target_id: target, abstain: false };
    },
    self_destruct: (args) => ({ reason: String(args.reason ?? "self_destruct"), confirm: Boolean(args.confirm) }),
  },
};
