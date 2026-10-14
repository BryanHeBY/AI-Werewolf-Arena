/**
 * 负责在原并发上限内领取审计任务、按原输入顺序收集结果及逐任务重试。
 * 输入为任务原引用、会话标识、执行器和限制；输出原发现或次数耗尽的失败条目，异常仍可能拒绝整个 run。
 * 本实例只驱动已有 executor，不创建／关闭会话；执行器与关闭责任由审计 pipeline 持有。
 * 超时交给每次 runTurn，任务领取和已完成结果不回滚；审计调用不提交游戏行动或修改录制。
 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import { formatErrorDiagnostic } from "../utils/error_diagnostic";
import type { AuditAgentExecutor } from "../ai/audit/contracts";
import { AuditAgentOutput, AuditAgentTask, shrinkAuditPayload } from "./payload_builder";

/** 限制数据由调用方提供；本类保原引用，不校验／归一化次数或并发，也不把 timeout 当成关闭确认。 */
export interface AuditTaskRunnerOptions {
  timeoutMs: number;
  maxAttempts: number;
  concurrency: number;
  displayLocale?: Locale;
}

/** 每次 run 独立持有 cursor／结果；重试只属于当前任务，executor 仍是调用方交付的同一实例。 */
export class AuditTaskRunner {
  constructor(
    private readonly executor: AuditAgentExecutor,
    private readonly sessionId: string,
    private readonly options: AuditTaskRunnerOptions,
  ) {}

  async run(tasks: AuditAgentTask[]): Promise<AuditAgentOutput[]> {
    // 结果槽按原任务 index 分配；并发完成顺序不决定输出顺序，不复制任务数组或发现对象。
    const results: AuditAgentOutput[] = new Array(tasks.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < tasks.length) {
        // 同步领取时先推进共享 cursor，再读取任务并等待；该 worker 失败不将 index 放回队列。
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
    // 首次沿用原 payload 引用；只有未提交 findings 的分支主动缩减，请求错误不在这里更换引用。
    let payload = task.payload;
    // 每轮原条件点读取 maxAttempts，每次调用读取 timeout；不提前缓存限制或增加总任务期限。
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
        // 先告警再缩减并替换；告警或缩减抛错也进入原 catch，已交付执行器的前缀不撤销。
        payload = shrinkAuditPayload(payload);
      } catch (error) {
        // 这里的诊断／告警本身不再被本层捕获；若再次失败，不能承诺一定返回耗尽条目。
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
