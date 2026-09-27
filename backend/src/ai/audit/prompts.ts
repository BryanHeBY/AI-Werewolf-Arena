import { AuditToolContext } from "./audit_tool_protocol";
export function auditTurnPrompt(turnId: string, mode: AuditToolContext["mode"]): string {
  const modeDirective = mode === "inspect"
    ? "最多提交 5 条 findings；每条 evidence 必须是上下文中存在的 seq。"
    : "Markdown 必须包含 Session、Bug Report Stats、Findings、TODO/Conclusion、Debug Pipeline；Findings 每条写 evidence=1,2，且只能引用上下文 findings.evidence。";
  return [
    `当前审计回合 ID：${turnId}`,
    `当前模式：${mode}`,
    "请通过审计工具读取上下文并提交结果。不要在普通文本中复制上下文或最终结果。",
    modeDirective,
  ].join("\n");
}
