/**
 * 负责 ACP 审计任务的独立 registry、创建等待与会话退役。输入为已解析 profile、任务上下文和超时；
 * 输出为工具提交、null 或清理失败；默认工厂每任务另建进程／工作目录，自定义工厂的隔离由提供方负责。
 * 本执行器持创建、活动和退役任务，按同一会话引用去重关闭；主失败与清理失败保留各自原对象。
 * 期限／取消只终止等待，迟到会话仍在回调尝试回收；有界 close 不承诺底层创建已全部结束。
 * 审计上下文、诊断与会话控制不授予游戏行动权，不修改原记录、角色库存或胜负。
 */
import * as path from "node:path";
import { AcpProcessClient } from "../../adapters/acp/acp-process-client";
import { AcpSession, AcpSessionFactory } from "../../adapters/acp/session";
import {
  ACP_CLOSE_TIMEOUT_MS,
  AcpInitializationCleanupError,
  closeAcpSession,
} from "../../adapters/acp/session-lifecycle";
import { awaitBeforeDeadline, awaitWithAbort } from "../../agents/runtime/turn-deadline";
import { AcpMcpBridgeFactory } from "../../adapters/acp/acp-mcp-bridge";
import { ResolvedAgentRuntimeProfile } from "../../app/config/contracts";
import { AgentTurnOptions } from "../../agents/runtime/agent-turn-executor";
import { AuditAgentExecutor } from "./contracts";
import { auditSystemPrompt, auditTurnPrompt } from "./prompts";
import { AuditMcpControlServer } from "../../adapters/acp/audit-mcp-control";
import { AuditSubmission, AuditToolContext, AuditToolTurnRegistry } from "./audit-tool-protocol";
/** 配置和可选工厂按原引用持有；workspace 路径只是任务资源位置，不构成进程／文件权限隔离。 */
export interface AcpAuditAgentExecutorOptions {
  profile: ResolvedAgentRuntimeProfile;
  workspaceRoot: string;
  sessionFactoryResolver?: (
    registry: AuditToolTurnRegistry,
    workspace: string,
  ) => AcpSessionFactory<AuditToolTurnRegistry>;
}

/** 每次 runTurn 自建 registry 与取消控制器；实际进程创建／关闭仍交指定会话工厂。 */
export class AcpAuditAgentExecutor implements AuditAgentExecutor {
  private nextSession = 0;
  // pending 是本执行器尚在等待的控制器；creating 可能在等待结束后仍有迟到结果。
  private readonly pending = new Set<AbortController>();
  private readonly sessions = new Set<AcpSession>();
  private closed = false;
  private readonly creating = new Set<Promise<AcpSession>>();
  private readonly retiring = new Set<Promise<void>>();
  // 同一原会话只登记一次退役任务，helper 内仍保普通失败后的强制尝试；retiring 接住失败，账本另保原错误。
  private readonly retired = new WeakMap<AcpSession, Promise<void>>();
  private readonly cleanupFailures: unknown[] = [];

  /** 仅返回资源登记计数；计数清空不等于任何未兑现的底层任务已被抢占或销毁。 */
  get runtimeState() {
    return {
      closed: this.closed,
      pending: this.pending.size,
      sessions: this.sessions.size,
      creating: this.creating.size,
      retiring: this.retiring.size,
    };
  }

  constructor(private readonly options: AcpAuditAgentExecutorOptions) {}

  async runTurn(
    context: AuditToolContext,
    options: AgentTurnOptions,
  ): Promise<AuditSubmission | null> {
    if (this.closed || options.timeoutMs <= 0) return null;
    // profile resolver 在计时器建立前取得；这段若抛错，由外部任务 runner 处理，尚无会话可退役。
    const registry = new AuditToolTurnRegistry(context.locale);
    const workspace = path.join(
      this.options.workspaceRoot,
      `${String(context.taskName).replace(/[^a-zA-Z0-9_-]/g, "_")}-${++this.nextSession}`,
    );
    const factory =
      this.options.sessionFactoryResolver?.(registry, workspace) ??
      this.createProcessFactory(registry, workspace);
    if (this.closed) return null;
    let session: AcpSession | undefined;
    let primary: unknown;
    let hasPrimary = false;
    const controller = new AbortController();
    this.pending.add(controller);
    const deadlineAtMs = Date.now() + options.timeoutMs;
    const timer = setTimeout(
      () => controller.abort(new Error("audit_acp_timeout")),
      options.timeoutMs,
    );
    try {
      const sessionTask = Promise.resolve().then(() =>
        factory.createSession({
          actorId: 0,
          registry,
          initialPrompt: auditSystemPrompt(registry.locale, true),
          deadlineAtMs,
          signal: controller.signal,
        }),
      );
      this.creating.add(sessionTask);
      // 等待取消不取消创建 Promise；迟到成功会强制退役，迟到独立清理失败进入执行器账本。
      void sessionTask.then(
        (lateSession) => {
          this.creating.delete(sessionTask);
          if (controller.signal.aborted || this.closed)
            void this.retire(lateSession, true).catch(() => undefined);
        },
        (error) => {
          this.creating.delete(sessionTask);
          if (
            error instanceof AcpInitializationCleanupError ||
            (controller.signal.aborted && error !== controller.signal.reason)
          )
            this.cleanupFailures.push(error);
        },
      );
      session = await awaitWithAbort(sessionTask, controller.signal);
      this.sessions.add(session);
      controller.signal.throwIfAborted();
      // 初始化只使用初始化提示；会话兑现并复核取消之后，才开放实际工具 turn。
      const turn = registry.openTurn(context, session.sessionId);
      const promptTask = session.prompt(
        auditTurnPrompt(turn.turnId, context.mode, registry.locale),
      );
      // 首个正式工具提交与 prompt 完成竞争；纯文本完成返回 null，不把它解析成审计提交。
      return await awaitWithAbort(
        Promise.race([
          turn.result,
          promptTask.then(
            () => null,
            (error) => {
              if (!controller.signal.aborted && !hasPrimary) {
                primary = error;
                hasPrimary = true;
              }
              return null;
            },
          ),
        ]),
        controller.signal,
      );
    } catch (error) {
      primary = error;
      hasPrimary = true;
      return null;
    } finally {
      clearTimeout(timer);
      // 先关闭工具 turn 和取消控制器，再退役实际会话；成功提交也不跳过这段清理。
      registry.closeTurn();
      this.pending.delete(controller);
      const force = controller.signal.aborted;
      controller.abort(new Error("audit_acp_turn_closed"));
      if (session) {
        this.sessions.delete(session);
        try {
          await this.retire(session, force);
        } catch (error) {
          // 原主错误与本次关闭错误独立汇总；清理失败可能覆盖正常／null 返回而向外抛出。
          if (hasPrimary)
            throw new AggregateError([primary, error], "audit_acp_turn_and_cleanup_failed");
          throw error;
        }
      }
    }
  }

  /** 先撤销活动等待，再有界等创建、等已登记退役；超时及关闭失败统一取出抛出，不吞账本。 */
  async close(): Promise<void> {
    this.closed = true;
    for (const controller of this.pending) {
      controller.abort(new Error("audit_acp_executor_closed"));
    }
    for (const session of this.sessions) void this.retire(session, true).catch(() => undefined);
    this.sessions.clear();
    try {
      await awaitBeforeDeadline(
        () => Promise.allSettled([...this.creating]),
        Date.now() + ACP_CLOSE_TIMEOUT_MS,
      );
    } catch (error) {
      this.cleanupFailures.push(error);
    }
    // accounted Promise 已接住各退役拒绝；此循环等待当前登记任务，未来迟到创建仍有自己的回收回调。
    while (this.retiring.size) await Promise.all([...this.retiring]);
    const failures = this.cleanupFailures.splice(0);
    if (failures.length) throw new AggregateError(failures, "audit_acp_close_failed");
  }

  /** 返回原关闭 Promise 供 turn 感知失败；另用接住错误的 Promise 跟踪，close 时仍可汇总同一失败。 */
  private retire(session: AcpSession, force: boolean): Promise<void> {
    const existing = this.retired.get(session);
    if (existing) return existing;
    const closing = closeAcpSession(session, force);
    this.retired.set(session, closing);
    const accounted = closing.catch((error) => {
      this.cleanupFailures.push(error);
    });
    this.retiring.add(accounted);
    void accounted.then(() => this.retiring.delete(accounted));
    return closing;
  }

  private createProcessFactory(
    registry: AuditToolTurnRegistry,
    workspace: string,
  ): AcpSessionFactory<AuditToolTurnRegistry> {
    const profile = this.options.profile;
    if (profile.kind !== "acp" || profile.provider.type !== "acp") {
      throw new Error("audit_acp_profile_required");
    }
    const extension = path.extname(__filename) === ".ts" ? ".ts" : ".js";
    const bridge: AcpMcpBridgeFactory<AuditToolTurnRegistry> = {
      serverName: "werewolf-audit",
      createControl: (turnRegistry) => new AuditMcpControlServer(turnRegistry),
      serverEntrypoint: () => path.join(__dirname, "../../adapters/acp", `audit-mcp-server${extension}`),
    };
    return new AcpProcessClient<AuditToolTurnRegistry>({
      command: profile.provider.command,
      args: [...(profile.provider.args ?? []), ...(profile.spawnArgs ?? [])],
      env: profile.provider.env,
      initializeTimeoutMs: profile.provider.initializeTimeoutMs,
      sessionConfigOptions: profile.provider.sessionConfigOptions,
      cwd: workspace,
      mcpBridge: bridge,
    });
  }
}
