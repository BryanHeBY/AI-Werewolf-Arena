import { ActionRequest } from "../../../core/domain/model";
import { colorize, isAnsiEnabled } from "../../../utils/ansi";
import { ChatMessage, ToolLoopStepTrace } from "./model_client";

export interface LlmObserverOptions {
  trace: boolean;
  colorizeLogs?: boolean;
  printLlmIo: boolean;
  printThinking: boolean;
}

/** Keeps terminal observability outside the game-decision orchestration. */
export class LlmObserver {
  private readonly recentEvents: string[] = [];
  private readonly colorizeLogs: boolean;

  constructor(private readonly options: LlmObserverOptions) {
    this.colorizeLogs = isAnsiEnabled(options.colorizeLogs);
  }

  trace(line: string): void {
    this.recentEvents.push(line);
    if (this.recentEvents.length > 80) this.recentEvents.shift();
    if (this.options.trace) console.log(this.decorate(line));
  }

  prompt(messages: ChatMessage[], request: ActionRequest): void {
    if (!this.options.printLlmIo) return;
    const prefix = colorize("[LLM_IO]", "accent", this.colorizeLogs);
    const marker = `player=${request.actorId} phase=${request.phase}`;
    console.log(`${prefix} prompt_start ${marker}`);
    for (const msg of messages) {
      const roleTag = msg.role === "system" ? "system" : msg.role === "user" ? "user" : "assistant";
      console.log(`${prefix} prompt_${roleTag}: ${msg.content}`);
    }
    console.log(`${prefix} prompt_end ${marker}`);
  }

  rawResponse(raw: string, request: ActionRequest): void {
    if (!this.options.printLlmIo) return;
    const prefix = colorize("[LLM_IO]", "accent", this.colorizeLogs);
    const marker = `player=${request.actorId} phase=${request.phase}`;
    console.log(`${prefix} raw_response_start ${marker}`);
    console.log(`${prefix} raw_response: ${raw}`);
    console.log(`${prefix} raw_response_end ${marker}`);
  }

  thinking(trace: ToolLoopStepTrace[], request: ActionRequest): void {
    if (!this.options.printThinking || trace.length === 0) return;
    const prefix = colorize("[THINKING]", "muted", this.colorizeLogs);
    const marker = `player=${request.actorId} phase=${request.phase}`;
    console.log(`${prefix} start ${marker}`);
    for (const [stepIndex, step] of trace.entries()) {
      if (step.assistantText?.trim()) {
        console.log(`${prefix} assistant step=${stepIndex + 1}: ${step.assistantText}`);
      }
      for (const call of step.toolCalls) {
        console.log(`${prefix} tool_call step=${stepIndex + 1} id=${call.id} name=${call.name} args=${call.rawArgs}`);
        console.log(`${prefix} tool_result step=${stepIndex + 1} id=${call.id} result=${call.toolResult}`);
      }
    }
    console.log(`${prefix} end ${marker}`);
  }

  thinkingText(assistantText: string, trace: ToolLoopStepTrace[]): string | null {
    const primary = assistantText.trim();
    if (primary) return primary.length > 1200 ? `${primary.slice(0, 1200)}…` : primary;
    for (let i = trace.length - 1; i >= 0; i--) {
      const text = trace[i]?.assistantText?.trim();
      if (text) return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
    }
    return null;
  }

  private decorate(line: string): string {
    const prefix = "[LLMActionProvider]";
    if (!this.colorizeLogs) return `${prefix} ${line}`;
    if (line.includes("request_ok")) return `${colorize(prefix, "ok", true)} ${colorize(line, "ok", true)}`;
    if (line.includes("request_recovered") || line.includes("request_timeout")) {
      return `${colorize(prefix, "warn", true)} ${colorize(line, "warn", true)}`;
    }
    if (line.includes("request_transport_fail")) {
      return `${colorize(prefix, "error", true)} ${colorize(line, "error", true)}`;
    }
    if (line.includes("request_start")) {
      return `${colorize(prefix, "info", true)} ${colorize(line, "info", true)}`;
    }
    return `${colorize(prefix, "muted", true)} ${colorize(line, "muted", true)}`;
  }
}
