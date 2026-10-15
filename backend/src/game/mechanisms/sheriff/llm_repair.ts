/**
 * 负责警长竞选、投票及方向工具的参数修复。输入为原 args；输出为原规范对象或 null。
 * 投票先判断 abstain，非放弃才 Number 转换并核有限正数，不在此加强整数；方向经 String 转换再白名单匹配。
 * 转换可执行 caller 行为或抛错，修复不代表候选／票权合法，也不提交任何票或改变方向。
 */
import { ToolRepairPack } from "../llm/contracts";

export const SHERIFF_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    run_for_sheriff: (args) => ({ run: Boolean(args.run) }),
    vote_for_sheriff: (args) => {
      // 放弃先返回，不读取target_id；非放弃的Number可触发调用方转换，异常保原前缀。
      const abstain = Boolean(args.abstain);
      if (abstain) return { target_id: null, abstain: true };
      const targetId = Number(args.target_id);
      return Number.isFinite(targetId) && targetId > 0
        ? { target_id: targetId, abstain: false }
        : null;
    },
    choose_direction: (args) => {
      const direction = String(args.direction ?? "");
      return ["clockwise", "counter_clockwise"].includes(direction) ? { direction } : null;
    },
  },
};
