import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { AuditToolContext } from "./audit_tool_protocol";

/** One semantic audit policy; transports only choose whether initialization may use tools. */
export function auditSystemPrompt(locale: Locale = "zh-CN", initializing = false): string {
  return [text(locale, "audit.prompt.identity"), text(locale, "audit.prompt.language"),
    text(locale, "audit.prompt.claims"), text(locale, "audit.prompt.boundaries"),
    ...(initializing ? [text(locale, "audit.prompt.acp.init")] : [text(locale, "audit.prompt.read"), text(locale, "audit.prompt.submit")]),
    text(locale, "audit.prompt.evidence"),
  ].join("\n");
}

export function auditTurnPrompt(turnId: string, mode: AuditToolContext["mode"], locale: Locale = "zh-CN"): string {
  return [text(locale, "audit.prompt.turn", { turn: turnId }), text(locale, "audit.prompt.mode", { mode }),
    text(locale, "audit.prompt.use_tools"), text(locale, mode === "inspect" ? "audit.prompt.inspect" : "audit.prompt.summary"),
  ].join("\n");
}
