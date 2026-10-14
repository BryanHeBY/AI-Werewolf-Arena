/**
 * 负责本地化审计提示的确定组装。输入为locale、初始化标记、turn ID 与inspect／summary模式；
 * 输出原提示字符串，正文／标题来自game-text，不在文本内加入完整证据payload。
 * 初始化只改变提示内容，不实现工具授权屏障；实际会话／turn／模式与提交校验归协议注册表。
 */
import { auditHeadings, text, type Locale } from "@ai-werewolf-arena/game-text";
import type { AuditToolContext } from "./audit_tool_protocol";

/** SDK／ACP共用原语义提示；初始化分支只给提示，不据字符串撤销工具或替代协议检查。 */
export function auditSystemPrompt(locale: Locale = "zh-CN", initializing = false): string {
  return [
    text(locale, "audit.prompt.identity"),
    text(locale, "audit.prompt.language"),
    text(locale, "audit.prompt.claims"),
    text(locale, "audit.prompt.boundaries"),
    ...(initializing
      ? [text(locale, "audit.prompt.acp.init")]
      : [text(locale, "audit.prompt.read"), text(locale, "audit.prompt.submit")]),
    text(locale, "audit.prompt.evidence"),
    text(locale, "audit.prompt.outcome"),
  ].join("\n");
}

export function auditTurnPrompt(
  turnId: string,
  mode: AuditToolContext["mode"],
  locale: Locale = "zh-CN",
): string {
  const headings = auditHeadings(locale);
  // 原inspect与summary文案按模式组装；只替换本地化标题参数，不改任何产品文本或证据。
  const directive =
    mode === "inspect"
      ? text(locale, "audit.prompt.inspect")
      : text(locale, "audit.prompt.summary", {
          session: headings.session,
          stats: headings.stats,
          findings: headings.findings,
          todo: headings.todo,
          conclusion: headings.conclusion,
          pipeline: headings.pipeline,
          none: text(locale, "common.none"),
        });
  return [
    text(locale, "audit.prompt.turn", { turn: turnId }),
    text(locale, "audit.prompt.mode", { mode }),
    text(locale, "audit.prompt.use_tools"),
    directive,
  ].join("\n");
}
