/**
 * 负责狼人聊天、刀票与自爆工具的原参数修复。输入为原 args；输出为规范对象或刀票 null。
 * 刀票先读 abstain，放弃时不读 target；String／Number 相关转换仍可执行 caller 方法或抛错。
 * 布尔化和文案修复不等于动作已接受，不写票、开自爆或授予当前权限。
 */
import { ToolRepairPack } from "../../llm/contracts";
import { numberOrNull } from "../../llm/helpers";

export const WOLF_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    speak_to_wolves: (args) => ({
      text: String(args.text ?? ""),
      end_chat: Boolean(args.end_chat),
    }),
    kill_vote: (args) => {
      // 放弃分支不读取target_id；非放弃才沿共享numberOrNull执行原转换。
      const abstain = Boolean(args.abstain);
      if (abstain) return { target_id: null, abstain: true };
      const target = numberOrNull(args.target_id);
      return target === null ? null : { target_id: target, abstain: false };
    },
    self_destruct: (args) => ({
      reason: String(args.reason ?? "self_destruct"),
      confirm: Boolean(args.confirm),
    }),
  },
};
