/**
 * 负责声明工具执行回执的纯数据契约。输入为执行状态和本人可见的已发表事实，输出为版本化反馈类型。
 * 不携带运行句柄，不授予执行权限，也不代表延后结算的伤害、保护或胜负已经发生。
 */
import type { ToolName } from "./actions";
import type { PlayerVisibleEvent } from "./events";

export type ActionExecutionReceipt = {
  ok: true;
  accepted: true;
  /** null 表示执行被打断或无法确认，不能据此推断已消耗的资源被退还。 */
  applied: boolean | null;
  action: ToolName;
  status: "resolved" | "committed" | "not_applied" | "unavailable" | "interrupted";
  feedback: {
    version: 1;
    /** 不包含全局序号、受众或隐藏的实际目标。下一轮事件流仍正常投递这些事实。 */
    events: Array<Pick<PlayerVisibleEvent, "type" | "payload">>;
  };
};
