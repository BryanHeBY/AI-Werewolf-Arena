import { EntityId, ToolCall, ToolName } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import { ToolCallRepairRegistry } from "../../../game/mechanisms";
import {
  DEFAULT_SPEAK_TEXT,
  SPEAK_TEXT_FILTER_KEYWORDS,
} from "./prompt_templates";

/** Compatibility strategy for model clients that cannot use native tools. */
export class LegacyResponseInterpreter {
  constructor(
    private readonly world: World,
    private readonly repairRegistry: ToolCallRepairRegistry,
  ) {}

  parse(raw: string, allowedTools: ToolName[], actorId: EntityId): ToolCall | null {
    const json = this.extractJson(raw);
    if (!json) return null;
    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== "object" || parsed.name === "none") return null;
    if (typeof parsed.name !== "string" || !allowedTools.includes(parsed.name)) return null;
    const rawArgs = parsed.args && typeof parsed.args === "object" ? parsed.args : {};
    const coerced = this.repairRegistry.coerceArgs(parsed.name, rawArgs, { actorId });
    if (!coerced) return null;
    return { name: parsed.name, args: coerced as any } as ToolCall;
  }

  isStructuredToolJson(raw: string): boolean {
    const json = this.extractJson(raw);
    if (!json) return false;
    try {
      const parsed = JSON.parse(json);
      return !!parsed && typeof parsed === "object" &&
        typeof parsed.name === "string" && parsed.args !== undefined;
    } catch {
      return false;
    }
  }

  returnedNone(raw: string): boolean {
    const json = this.extractJson(raw);
    if (!json) return false;
    try {
      return JSON.parse(json)?.name === "none";
    } catch {
      return false;
    }
  }

  recover(raw: string, allowedTools: ToolName[], actorId: EntityId): ToolCall | null {
    const cleaned = raw
      .replace(/<think>/gi, "")
      .replace(/<\/think>/gi, "")
      .replace(/```[\s\S]*?```/g, "")
      .trim();
    if (!cleaned || allowedTools.length !== 1) return null;
    return this.repairRegistry.recover(allowedTools[0], cleaned, {
      actorId,
      world: this.world,
      toSpeakText: (text) => this.toSpeakText(text),
    });
  }

  private extractJson(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const withoutThink = trimmed.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    for (const text of [trimmed, withoutThink]) {
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch?.[1]?.includes('"name"')) return fenceMatch[1].trim();
      for (const candidate of this.collectBalancedJsonObjects(text)) {
        if (candidate.includes('"name"') && candidate.includes('"args"')) return candidate;
      }
    }
    return null;
  }

  private collectBalancedJsonObjects(text: string): string[] {
    const out: string[] = [];
    const stack: number[] = [];
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") stack.push(i);
      else if (ch === "}") {
        const start = stack.pop();
        if (start !== undefined) out.push(text.slice(start, i + 1));
      }
    }
    return out.reverse();
  }

  private toSpeakText(text: string): string {
    const withoutMetaLines = text
      .split(/\r?\n/)
      .filter((line) => {
        const lower = line.trim().toLowerCase();
        return !!lower && !SPEAK_TEXT_FILTER_KEYWORDS.some((keyword) => lower.includes(keyword));
      })
      .join(" ");
    const cleaned = withoutMetaLines
      .replace(/<think>/gi, "")
      .replace(/<\/think>/gi, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\{[\s\S]{20,}\}/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const lower = cleaned.toLowerCase();
    const seemsPromptEcho = [
      "actorid", "allowedtools", "actionwindow", "可用工具", "行动窗口",
      "阶段上下文", "json", "tool",
    ].some((keyword) => lower.includes(keyword));
    return !cleaned || cleaned.length < 4 || seemsPromptEcho
      ? DEFAULT_SPEAK_TEXT
      : cleaned.slice(0, 120);
  }
}
