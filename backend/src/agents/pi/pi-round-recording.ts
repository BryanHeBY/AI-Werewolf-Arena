/**
 * 负责 Pi 单轮各次派发及私有输出的编码；只持本轮增量，不持原生会话或完整历史。
 * 实时归一结果先留底再交展示；补读只处理未通知的原生事件，避免录制时重复转换整条轨迹。
 * 会话回收、失败政策和最终录制仍归 provider；显示失败按原对象交还，不丢弃已有记录。
 */
import {
  agentOutputToDeltaMessages,
  splitPlayerRecordText,
  type AgentOutput,
  type AgentOutputContext,
  type AgentOutputSink,
  type ReplayPlayerDeltaMessage,
} from "@ai-werewolf-arena/replay-contract";
import { createPiOutputObserver } from "../../adapters/pi/pi-output";
import type { PiPromptResult, PiSessionEvent } from "../../adapters/pi/contracts";
import type { PlayerInputDispatch, PlayerRoundOutcome } from "../player/contracts";

interface Attempt {
  input: string;
  outputs: AgentOutput[];
  thinkingText: string;
}

export class PiRoundRecording {
  private readonly attempts: Attempt[] = [];
  private active?: {
    attempt: Attempt;
    normalizer: ReturnType<typeof createPiOutputObserver>;
    seen: Set<PiSessionEvent>;
    display: boolean;
    displayErrors: unknown[];
  };
  private readonly flushErrors: unknown[] = [];

  constructor(
    private readonly context: AgentOutputContext,
    private readonly display: AgentOutputSink,
  ) {}

  /** 调用传输入口前登记一次；显示预检失败时不会走到这里。 */
  begin(input: string): void {
    const attempt: Attempt = { input, outputs: [], thinkingText: "" };
    const active: NonNullable<PiRoundRecording["active"]> = {
      attempt,
      seen: new Set<PiSessionEvent>(),
      display: true,
      displayErrors: [] as unknown[],
      normalizer: createPiOutputObserver(this.context, (event) => {
        attempt.outputs.push(structuredClone(event.output));
        if (active.display) {
          try {
            this.display(event);
          } catch (error) {
            active.displayErrors.push(error);
          }
        }
      }),
    };
    this.attempts.push(attempt);
    this.active = active;
  }

  update(event: PiSessionEvent): void {
    const active = this.active!;
    active.seen.add(event);
    // 一个事件的全部归一结果先留底，显示错误随后交 Pi 会话隔离，不截断工具事实。
    active.normalizer.update(event);
    this.throwDisplayErrors(active.displayErrors.splice(0));
  }

  finish(trace: PiPromptResult<unknown>): void {
    const active = this.active!;
    active.attempt.thinkingText = trace.thinkingText;
    active.display = false;
    for (const event of trace.events) if (!active.seen.has(event)) active.normalizer.update(event);
    active.display = true;
    active.normalizer.flush();
    this.flushErrors.push(...active.displayErrors.splice(0));
    const outputs = active.attempt.outputs;
    // 合成/旧传输可只给汇总；已经有原生文本时不再次追加同一正文。
    if (!outputs.some((output) => output.type === "text")) {
      if (trace.thinkingText)
        outputs.unshift({ type: "text", channel: "thinking", text: trace.thinkingText });
      if (trace.assistantText)
        outputs.push({ type: "text", channel: "message", text: trace.assistantText });
    }
    this.active = undefined;
  }

  flush(): void {
    this.throwDisplayErrors(this.flushErrors.splice(0));
  }

  get inputs(): PlayerInputDispatch[] {
    return this.attempts.map(({ input }) => ({
      mode: "session_delta",
      messages: [{ role: "user", content: input }],
    }));
  }

  get thinkingText(): string {
    return this.attempts
      .map((attempt) => attempt.thinkingText)
      .filter(Boolean)
      .join("\n");
  }

  messages(calls: PlayerRoundOutcome["toolCalls"]): ReplayPlayerDeltaMessage[] {
    const messages: ReplayPlayerDeltaMessage[] = [];
    const recordedCalls = new Set<string>();
    for (const [index, attempt] of this.attempts.entries()) {
      for (const content of attempt.input ? splitPlayerRecordText(attempt.input) : [])
        messages.push({ role: "user", kind: index === 0 ? "prompt" : "retry_prompt", content });
      const outputs = attempt.outputs.map((output) => {
        if (output.type !== "tool" || !output.id) return output;
        const call = calls.find((call) => call.id === output.id);
        if (!call) return output;
        recordedCalls.add(output.id);
        return output.status === "started"
          ? { ...output, args: call.args, accepted: call.accepted }
          : output.status === "completed" || output.status === "failed"
            ? { ...output, result: call.result }
            : output;
      });
      messages.push(...agentOutputToDeltaMessages(outputs));
    }
    for (const call of calls) {
      if (call.id && recordedCalls.has(call.id)) continue;
      messages.push(
        ...agentOutputToDeltaMessages([
          {
            type: "tool",
            id: call.id,
            name: call.name,
            status: "started",
            args: call.args,
            accepted: call.accepted,
          },
          { type: "tool", id: call.id, name: call.name, status: "completed", result: call.result },
        ]),
      );
    }
    return messages;
  }

  private throwDisplayErrors(errors: unknown[]): void {
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "pi_output_display_failed");
  }
}
