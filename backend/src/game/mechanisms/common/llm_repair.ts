/**
 * 负责通用发言与投票的参数修复表；输入原参数记录，输出新候选记录或 null。
 * 表与处理器引用保持可写，修复仅改变候选形状，不接受请求、付款或授予库存。
 * 字段 getter 及 String／Number 转换可能抛错，异常原样传播，不用空候选吞掉失败。
 */
import { ToolRepairPack } from "../llm/contracts";
import { numberOrNull } from "../llm/helpers";

/** 通用表按原 speak、vote 顺序供 registry 登记；不把本表的存在当作行动者许可。 */
export const COMMON_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    // 先读 text，只有 nullish 才补空串；String 可调用对象转换逻辑，既有文案和错误不在此改写。
    speak: (args) => ({ text: String(args.text ?? "") }),
    vote: (args) => {
      // 先读弃权字段并取原 truthiness；弃权命中即返回，不读取可能带 getter 的 target_id。
      const abstain = Boolean(args.abstain);
      if (abstain) return { target_id: null, abstain: true };
      // 非弃权才转换目标；有限数值仍只是候选，目标存在、范围和投票资格由下游校验。
      const target = numberOrNull(args.target_id);
      return target === null ? null : { target_id: target, abstain: false };
    },
  },
};
