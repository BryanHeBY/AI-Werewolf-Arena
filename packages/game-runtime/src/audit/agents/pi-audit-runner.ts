/**
 * 负责 Pi 的独立内存审计任务。每个任务有自己的审计 registry、会话与期限，不复用玩家历史。
 * 输入是已解析 Pi profile 和单次审计上下文；输出为正式提交或 null，关闭异常保留原错。
 * 模型只通过既有审计工具正式提交；普通文本不是审计结果，关闭会先撤销工具权限再回收会话。
 */
import { toolFailure } from "@ai-werewolf-arena/game-text";
import { PiRuntime, type PiSession } from "../../adapters/pi";
import type { ResolvedAgentRuntimeProfile } from "../../app/config/contracts";
import type { AgentTurnOptions } from "../../agents/runtime/agent-turn-executor";
import { awaitWithAbort } from "../../agents/runtime/turn-deadline";
import type { AuditAgentExecutor } from "./contracts";
import { auditSystemPrompt, auditTurnPrompt } from "./prompts";
import {
  auditToolProtocol,
  AuditToolTurnRegistry,
  type AuditSubmission,
  type AuditToolContext,
} from "./audit-tool-protocol";

export class PiAuditAgentExecutor implements AuditAgentExecutor {
  private runtime?: Promise<PiRuntime>;
  private readonly controllers = new Set<AbortController>();
  private readonly pending = new Set<Promise<AuditSubmission | null>>();
  private closed = false;
  private closing?: Promise<void>;
  private nextTurn = 0;
  constructor(private readonly profile: ResolvedAgentRuntimeProfile) {
    if (profile.kind !== "pi" || profile.provider.type !== "pi")
      throw new Error("audit_pi_profile_required");
  }
  get runtimeState() {
    return { closed: this.closed, turns: this.pending.size };
  }

  runTurn(context: AuditToolContext, options: AgentTurnOptions): Promise<AuditSubmission | null> {
    if (this.closed || options.timeoutMs <= 0) return Promise.resolve(null);
    const deadline = Date.now() + options.timeoutMs;
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(
      () => controller.abort(new Error("audit_pi_timeout")),
      options.timeoutMs,
    );
    const task = Promise.resolve().then(() => this.execute(context, controller.signal, deadline));
    this.pending.add(task);
    const cleanup = () => {
      clearTimeout(timer);
      this.controllers.delete(controller);
      this.pending.delete(task);
    };
    return task.then(
      (value) => {
        cleanup();
        return value;
      },
      (error) => {
        cleanup();
        throw error;
      },
    );
  }

  private async execute(
    context: AuditToolContext,
    signal: AbortSignal,
    deadline: number,
  ): Promise<AuditSubmission | null> {
    const locale = context.locale ?? "zh-CN";
    const registry = new AuditToolTurnRegistry(locale);
    const sessionId = `pi-audit-${++this.nextTurn}`;
    let session: PiSession | undefined;
    let failure: unknown;
    let failed = false;
    const revoke = () => registry.closeTurn();
    signal.addEventListener("abort", revoke, { once: true });
    try {
      signal.throwIfAborted();
      if (this.profile.provider.type !== "pi") throw new Error("audit_pi_profile_required");
      this.runtime ??= PiRuntime.create({
        models: this.profile.provider.models,
        auth: this.profile.provider.auth,
      });
      // 本地模型运行时仍登记实际 Promise；取消不遗失迟到创建，其关闭由 executor.close 持有。
      const runtime = await awaitWithAbort(this.runtime, signal);
      signal.throwIfAborted();
      session = await runtime.createSession({
        settings: { ...this.profile.piSettings },
        systemPrompt: auditSystemPrompt(context.locale),
        tools: auditToolProtocol(context.locale).specs,
      });
      signal.throwIfAborted();
      const turn = registry.openTurn(context, sessionId);
      const result = await session.prompt<AuditSubmission>(
        auditTurnPrompt(turn.turnId, context.mode, context.locale),
        {
          signal,
          maxSteps: 6,
          onToolCall: async (invocation) => {
            if (signal.aborted || this.closed || Date.now() >= deadline)
              return {
                toolResult: toolFailure(locale, "turn_not_open_or_session_invalid"),
                stop: true,
              };
            if (invocation.name === "get_audit_schema")
              return { toolResult: { ...registry.getSchema() } };
            if (invocation.name === "get_audit_context")
              return { toolResult: { ...registry.getContext(sessionId, invocation.args) } };
            const receipt =
              invocation.name === "submit_audit_findings"
                ? registry.submitFindings(sessionId, invocation.args)
                : invocation.name === "submit_audit_summary"
                  ? registry.submitSummary(sessionId, invocation.args)
                  : toolFailure(locale, "unknown_audit_tool");
            const submission = receipt.ok ? await turn.result : null;
            return {
              toolResult: { ...receipt },
              ...(submission ? { finalAction: submission, stop: true } : {}),
            };
          },
        },
      );
      signal.throwIfAborted();
      return this.closed || Date.now() >= deadline ? null : result.finalAction;
    } catch (error) {
      // 与现有审计入口相同：没有正式工具提交时交 pipeline 重试；清理失败不能被此分支隐藏。
      failure = error;
      failed = true;
      return null;
    } finally {
      registry.closeTurn();
      signal.removeEventListener("abort", revoke);
      if (session)
        try {
          await session.close();
        } catch (cleanup) {
          throw failed
            ? new AggregateError([failure, cleanup], "audit_pi_turn_and_cleanup_failed")
            : cleanup;
        }
    }
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    for (const controller of this.controllers) controller.abort(new Error("audit_pi_closed"));
    this.closing = (async () => {
      const settled = await Promise.allSettled([...this.pending]);
      const failures = settled.flatMap((item) => (item.status === "rejected" ? [item.reason] : []));
      if (this.runtime)
        try {
          await (await this.runtime).close();
        } catch (error) {
          failures.push(error);
        }
      if (failures.length) throw new AggregateError(failures, "audit_pi_close_failed");
    })();
    return this.closing;
  }
}
