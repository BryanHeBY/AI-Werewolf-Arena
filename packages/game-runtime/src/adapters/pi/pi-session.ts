/**
 * 负责一名玩家的 Pi 内存会话、真实流前缀与物理收尾。
 * 每次 prompt 只借出当轮工具回调；取消立即撤回借用，底层仍须实际结算后才能释放占用。
 * 接受候选后用 Pi 正常 turn-end 结束，不以 abort 伪装成功，也不额外请求模型。
 * 显示异常单独保留，不能中断协议消费；工具/模型/取消错误与清理错误按原对象汇总。
 * 单次 deadline 由宿主 signal 跨重试传递；maxSteps 只限制模型步数，不能重置或替代真实期限。
 */
import {
  createAgentSession,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentSessionEvent,
  type ModelRuntime,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ToolInvocation } from "../llm/transport";
import type {
  PiPromptOptions,
  PiPromptResult,
  PiSessionEvent,
  PiSessionOptions,
  PiToolTrace,
} from "./contracts";
import { emptyPiResourceLoader } from "./empty-resource-loader";
import { validatePiSettings } from "./native-config";

interface PromptScope {
  active: boolean;
  stop: boolean;
  steps: number;
  maxSteps: number;
  finalAction: unknown;
  trace: PiPromptResult<unknown>;
  options: PiPromptOptions<unknown>;
  failures: unknown[];
  displayFailures: unknown[];
  invalidWork: Promise<void>;
  executed: Set<string>;
  calls: Map<string, ToolInvocation>;
  blocks: Map<string, string>;
  messageIndex: number;
  assistantError?: unknown;
}

function failTogether(failures: unknown[]): never {
  const unique = [...new Set(failures)];
  if (unique.length === 1) throw unique[0];
  throw new AggregateError(unique, "pi_prompt_failed");
}

function emptyTrace<T>(): PiPromptResult<T> {
  return { finalAction: null, assistantText: "", thinkingText: "", toolCalls: [], events: [] };
}

export class PiSession {
  private scope?: PromptScope;
  private lastTrace: PiPromptResult<unknown> = emptyTrace();
  private pending?: Promise<PiPromptResult<unknown>>;
  private closing?: Promise<void>;
  private closed = false;

  private constructor(
    private readonly sdk: AgentSession,
    private readonly settings: SettingsManager,
    private readonly onClosed: () => void,
  ) {
    sdk.agent.toolExecution = "sequential";
    const onPayload = sdk.agent.onPayload;
    sdk.agent.onPayload = async (payload, model) => {
      const body = (await onPayload?.(payload, model)) ?? payload;
      // Pi 1.3 的 Codex simple 传输会丢掉 serviceTier；沿公开 payload 钩子读取原生模型参数。
      // 仅补 Codex 的该字段，不更改其它协议正文，也不重新开放文件工具或扩展发现。
      const tier =
        model.api === "openai-codex-responses" ? model.samplingParams?.service_tier : undefined;
      if (tier === undefined) return body;
      if (
        typeof tier !== "string" ||
        !["auto", "default", "flex", "priority", "fast"].includes(tier)
      )
        throw new Error("pi_model_service_tier_invalid");
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error("pi_provider_payload_invalid");
      // 旧 Codex 订阅端点不接受 fast 字面值；改用同一服务档位的 priority 别名。
      return { ...body, service_tier: tier === "fast" ? "priority" : tier };
    };
    const before = sdk.agent.beforeToolCall;
    sdk.agent.beforeToolCall = async (context, signal) => {
      const scope = this.scope;
      await scope?.invalidWork;
      if (!scope?.active || scope.stop || signal?.aborted || scope.options.signal?.aborted)
        return { block: true, reason: "pi_turn_not_open", terminate: true };
      return before?.(context, signal);
    };
    const prepare = sdk.agent.prepareRequest;
    sdk.agent.prepareRequest = async (request, signal) => {
      const scope = this.scope;
      await scope?.invalidWork;
      if (!scope?.active || scope.options.signal?.aborted)
        throw scope?.options.signal?.reason ?? new Error("pi_turn_not_open");
      return (await prepare?.(request, signal)) ?? undefined;
    };
    const finish = sdk.agent.finishTurn;
    sdk.agent.finishTurn = async (turn, signal) => {
      const decision = await finish?.(turn, signal);
      const scope = this.scope;
      await scope?.invalidWork;
      if (
        scope &&
        (++scope.steps >= scope.maxSteps ||
          scope.stop ||
          !scope.active ||
          scope.failures.length > 0)
      )
        return { action: "end" };
      return decision ?? undefined;
    };
    sdk.subscribe((event) => this.consume(event));
  }

  static async create(
    runtime: ModelRuntime,
    providers: ReadonlySet<string>,
    options: PiSessionOptions,
    onClosed: () => void,
  ): Promise<PiSession> {
    const nativeSettings = validatePiSettings(options.settings);
    const settings = SettingsManager.inMemory(nativeSettings);
    const provider = settings.getDefaultProvider()!;
    const modelId = settings.getDefaultModel()!;
    if (!providers.has(provider)) throw new Error(`pi_provider_not_configured: ${provider}`);
    const model = runtime.getModel(provider, modelId);
    if (!model) throw new Error(`pi_model_not_found: ${provider}/${modelId}`);
    const names = options.tools.map((tool) => tool.name);
    const forbidden = new Set([
      "bash",
      "powershell",
      "read",
      "write",
      "edit",
      "find",
      "grep",
      "ls",
      "codemode",
      "tool_search",
    ]);
    if (
      new Set(names).size !== names.length ||
      names.some((name) => !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name) || forbidden.has(name))
    )
      throw new Error("pi_tool_allowlist_invalid");
    let owner: PiSession | undefined;
    const customTools: ToolDefinition[] = options.tools.map((tool) => ({
      name: tool.name,
      label: tool.name,
      description: tool.description,
      parameters: Type.Unsafe<Record<string, unknown>>(structuredClone(tool.parameters)),
      executionMode: "sequential",
      execute: async (id, args, signal) => {
        if (!owner) throw new Error("pi_session_not_ready");
        return owner.execute(id, tool.name, args as Record<string, unknown>, signal);
      },
    }));
    const { session } = await createAgentSession({
      // 虚拟路径仅用于 Pi 提示元数据；这些路径不会被发现、创建或持久化。
      cwd: "/awa/pi-memory",
      agentDir: "/awa/pi-memory/agent",
      modelRuntime: runtime,
      model,
      thinkingLevel:
        settings.getModelThinkingLevel(provider, modelId) ?? settings.getDefaultThinkingLevel(),
      resourceLoader: emptyPiResourceLoader(options.systemPrompt),
      sessionManager: SessionManager.inMemory("/awa/pi-memory"),
      settingsManager: settings,
      noTools: "builtin",
      tools: names,
      customTools,
    });
    const actual = session.getActiveToolNames();
    if (actual.length !== names.length || actual.some((name) => !names.includes(name))) {
      session.dispose();
      throw new Error("pi_tool_allowlist_mismatch");
    }
    owner = new PiSession(session, settings, onClosed);
    return owner;
  }

  /** 返回本轮原始前缀，失败时仍可读取；不把它回灌成第二份 Pi 历史。 */
  takeTrace<T = never>(): PiPromptResult<T> {
    const trace = this.scope?.trace ?? this.lastTrace;
    return {
      ...trace,
      events: [...trace.events],
      toolCalls: [...trace.toolCalls],
    } as PiPromptResult<T>;
  }

  get runtimeState(): { closed: boolean; pending: number } {
    return { closed: this.closed, pending: this.pending ? 1 : 0 };
  }

  prompt<T>(text: string, options: PiPromptOptions<T>): Promise<PiPromptResult<T>> {
    if (this.closed || this.closing) return Promise.reject(new Error("pi_session_closed"));
    if (this.pending) return Promise.reject(new Error("pi_session_busy"));
    this.lastTrace = emptyTrace();
    if (
      options.maxSteps !== undefined &&
      (!Number.isSafeInteger(options.maxSteps) || options.maxSteps < 1)
    )
      return Promise.reject(new Error("pi_max_steps_invalid"));
    const scope: PromptScope = {
      active: true,
      stop: false,
      steps: 0,
      maxSteps: options.maxSteps ?? 12,
      finalAction: null,
      trace: emptyTrace(),
      options: options as PiPromptOptions<unknown>,
      failures: [],
      displayFailures: [],
      invalidWork: Promise.resolve(),
      executed: new Set(),
      calls: new Map(),
      blocks: new Map(),
      messageIndex: 0,
    };
    this.scope = scope;
    // 先登记占用再进入 SDK；SDK 的同步事件可重入宿主，不能在该窗口开放第二轮。
    const pending = Promise.resolve().then(() => this.run(text, scope));
    this.pending = pending;
    // 使用有拒绝处理的分支清占用，避免 finally 派生出无人处理的 rejection。
    void pending.then(
      () => {
        if (this.pending === pending) this.pending = undefined;
      },
      () => {
        if (this.pending === pending) this.pending = undefined;
      },
    );
    return pending as Promise<PiPromptResult<T>>;
  }

  private async run(text: string, scope: PromptScope): Promise<PiPromptResult<unknown>> {
    let abortWork: Promise<void> | undefined;
    const abort = () => {
      scope.active = false;
      abortWork ??= this.sdk.abort().catch((error) => {
        scope.failures.push(error);
      });
    };
    const signal = scope.options.signal;
    signal?.addEventListener("abort", abort, { once: true });
    try {
      if (signal?.aborted) throw signal.reason;
      if (!scope.active) throw new Error("pi_session_closed");
      await this.sdk.prompt(text, { expandPromptTemplates: false, source: "rpc" });
    } catch (error) {
      scope.failures.push(error);
    } finally {
      scope.active = false;
      signal?.removeEventListener("abort", abort);
      try {
        await this.sdk.waitForIdle();
      } catch (error) {
        scope.failures.push(error);
      }
      await abortWork;
      await scope.invalidWork;
      scope.trace.finalAction = scope.finalAction;
      this.lastTrace = scope.trace;
      if (this.scope === scope) this.scope = undefined;
    }
    if (signal?.aborted) scope.failures.unshift(signal.reason);
    else if (scope.assistantError !== undefined) scope.failures.push(scope.assistantError);
    scope.failures.push(...scope.displayFailures);
    if (scope.failures.length > 0) failTogether(scope.failures);
    return scope.trace;
  }

  private async execute(
    id: string,
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    const scope = this.scope;
    if (!scope?.active || scope.stop || signal?.aborted || scope.options.signal?.aborted)
      throw new Error("pi_turn_not_open");
    const invocation = scope.calls.get(id) ?? { id, name, args, rawArgs: JSON.stringify(args) };
    scope.executed.add(id);
    try {
      const response = await scope.options.onToolCall(invocation);
      if (!scope.active || signal?.aborted || scope.options.signal?.aborted)
        throw scope.options.signal?.reason ?? new Error("pi_late_tool_result");
      const hasFinalAction =
        Object.prototype.hasOwnProperty.call(response, "finalAction") &&
        response.finalAction !== undefined;
      if (hasFinalAction) scope.finalAction = response.finalAction;
      scope.stop ||= response.stop === true || hasFinalAction;
      const trace: PiToolTrace = {
        ...invocation,
        toolResult: response.toolResult,
        stop: response.stop === true,
        hasFinalAction,
      };
      scope.trace.toolCalls.push(trace);
      return {
        content: [
          {
            type: "text" as const,
            text:
              typeof response.toolResult === "string"
                ? response.toolResult
                : JSON.stringify(response.toolResult),
          },
        ],
        details: undefined,
      };
    } catch (error) {
      scope.failures.push(error);
      scope.stop = true;
      throw error;
    }
  }

  private emit(scope: PromptScope, event: PiSessionEvent): void {
    scope.trace.events.push(event);
    try {
      scope.options.onEvent?.(event);
    } catch (error) {
      scope.displayFailures.push(error);
    }
  }

  private block(
    scope: PromptScope,
    index: number,
    type: "thinking" | "message",
    text: string,
  ): void {
    const blockId = `${scope.messageIndex}:${index}`;
    scope.blocks.set(blockId, (scope.blocks.get(blockId) ?? "") + text);
    if (type === "thinking") scope.trace.thinkingText += text;
    else scope.trace.assistantText += text;
    if (text) this.emit(scope, { type, text, partial: true, blockId });
  }

  private consume(event: AgentSessionEvent): void {
    const scope = this.scope;
    if (!scope) return;
    // 不向 SDK 同步事件抛错；内部处理失败同样在真实结算后回传，不能损坏后续工具消费。
    try {
      if (event.type === "message_start" && event.message.role === "assistant") {
        scope.messageIndex++;
      } else if (event.type === "message_update") {
        const update = event.assistantMessageEvent;
        if (update.type === "thinking_delta")
          this.block(scope, update.contentIndex, "thinking", update.delta);
        else if (update.type === "text_delta")
          this.block(scope, update.contentIndex, "message", update.delta);
      } else if (event.type === "message_end" && event.message.role === "assistant") {
        event.message.content.forEach((block, index) => {
          if (block.type === "toolCall") {
            scope.calls.set(block.id, {
              id: block.id,
              name: block.name,
              args: block.arguments,
              rawArgs: JSON.stringify(block.arguments),
            });
          } else if (block.type === "thinking" || block.type === "text") {
            const type = block.type === "thinking" ? "thinking" : "message";
            const text = block.type === "thinking" ? block.thinking : block.text;
            const blockId = `${scope.messageIndex}:${index}`;
            const received = scope.blocks.get(blockId) ?? "";
            if (text.startsWith(received))
              this.block(scope, index, type, text.slice(received.length));
            this.emit(scope, { type, text: "", partial: false, blockId });
          }
        });
        scope.assistantError =
          event.message.stopReason === "error" || event.message.stopReason === "aborted"
            ? new Error(event.message.errorMessage ?? `pi_model_${event.message.stopReason}`)
            : undefined;
      } else if (event.type === "tool_execution_start") {
        this.emit(scope, {
          type: "tool_start",
          id: event.toolCallId,
          name: event.toolName,
          args: event.args,
        });
      } else if (event.type === "tool_execution_end") {
        this.emit(scope, {
          type: "tool_end",
          id: event.toolCallId,
          name: event.toolName,
          result: event.result,
          isError: event.isError,
        });
        if (event.isError && !scope.executed.has(event.toolCallId) && scope.active && !scope.stop) {
          const invocation = scope.calls.get(event.toolCallId) ?? {
            id: event.toolCallId,
            name: event.toolName,
            args: {},
            rawArgs: "{}",
          };
          scope.invalidWork = scope.invalidWork
            .then(async () => {
              if (!scope.active || scope.stop) return;
              const result = await scope.options.onInvalidToolCall?.(invocation);
              if (result?.stop) scope.stop = true;
            })
            .catch((error) => {
              scope.failures.push(error);
              scope.stop = true;
            });
        }
      } else if (event.type === "auto_retry_start") {
        this.emit(scope, {
          type: "retry_start",
          attempt: event.attempt,
          maxAttempts: event.maxAttempts,
          delayMs: event.delayMs,
          errorMessage: event.errorMessage,
        });
      } else if (event.type === "auto_retry_end") {
        this.emit(scope, {
          type: "retry_end",
          success: event.success,
          attempt: event.attempt,
          ...(event.finalError !== undefined ? { finalError: event.finalError } : {}),
        });
      } else if (event.type === "agent_settled") {
        this.emit(scope, { type: "settled", aborted: event.aborted });
      }
    } catch (error) {
      scope.failures.push(error);
      scope.stop = true;
    }
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    if (this.scope) this.scope.active = false;
    this.closing = (async () => {
      const failures: unknown[] = [];
      try {
        await this.sdk.abort();
      } catch (error) {
        failures.push(error);
      }
      // prompt 的模型/显示错误由调用者接收；这里只等待实际占用解除，取消/清理错误独立回传。
      await this.pending?.catch(() => {});
      try {
        await this.sdk.waitForIdle();
      } catch (error) {
        failures.push(error);
      }
      try {
        await this.settings.flush();
      } catch (error) {
        failures.push(error);
      }
      failures.push(...this.settings.drainErrors().map((entry) => entry.error));
      let disposed = false;
      try {
        this.sdk.dispose();
        disposed = true;
      } catch (error) {
        failures.push(error);
      }
      if (disposed) this.onClosed();
      if (failures.length) failTogether(failures);
    })();
    return this.closing;
  }
}
