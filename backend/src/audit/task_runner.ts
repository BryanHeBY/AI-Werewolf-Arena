import type { Locale } from "@ai-werewolf-arena/game-text";
import { formatErrorDiagnostic } from "../utils/error_diagnostic";
import type { AuditAgentExecutor } from "../ai/audit/contracts";
import {
  AuditAgentOutput,
  AuditAgentTask,
  shrinkAuditPayload,
} from "./payload_builder";

export interface AuditTaskRunnerOptions {
  timeoutMs: number;
  maxAttempts: number;
  concurrency: number;
  displayLocale?: Locale;
}

/** Runs independent audit tasks with bounded concurrency and adaptive payload retries. */
export class AuditTaskRunner {
  constructor(
    private readonly executor: AuditAgentExecutor,
    private readonly sessionId: string,
    private readonly options: AuditTaskRunnerOptions,
  ) {}

  async run(tasks: AuditAgentTask[]): Promise<AuditAgentOutput[]> {
    const results: AuditAgentOutput[] = new Array(tasks.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < tasks.length) {
        const index = cursor++;
        results[index] = await this.runOne(tasks[index]);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(this.options.concurrency, tasks.length) }, worker),
    );
    return results;
  }

  private async runOne(task: AuditAgentTask): Promise<AuditAgentOutput> {
    const locale = task.locale ?? "zh-CN";
    let payload = task.payload;
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        const result = await this.executor.runTurn(
          { mode: "inspect", locale, taskName: task.name, source: task.source, payload },
          { timeoutMs: this.options.timeoutMs },
        );
        if (result?.kind === "findings") return result;
        console.warn(
          `[debug_summary] agent_rejected_reason=no_tool_submission session_id=${this.sessionId} agent=${task.name} attempt=${attempt}/${this.options.maxAttempts}`,
        );
        payload = shrinkAuditPayload(payload);
      } catch (error) {
        console.warn(
          `[debug_summary] agent_rejected_reason=request_error session_id=${this.sessionId} agent=${task.name} attempt=${attempt}/${this.options.maxAttempts} error=${formatErrorDiagnostic(error, this.options.displayLocale ?? locale)}`,
        );
      }
    }
    return {
      agent: task.name,
      findings: [],
      notes: [],
      missing_info: ["agent_failed"],
      failed: true,
      failure_reason: "exhausted_attempts",
    };
  }
}
