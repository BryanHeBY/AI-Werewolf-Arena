/**
 * 负责可公开玩家展示标签的纯数据准入。输入为未知模型标签，输出短文本检查；
 * 不读取 Agent 配置、推断角色或暴露 provider、密钥和接入参数。
 */
export function isReplayModelLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 200 &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}
