import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  Camp,
  EntityId,
  Phase,
  PotionType,
  Role,
  ToolCall,
  ToolName,
} from "../domain/model";
import { World } from "../domain/world";
import { colorize, isAnsiEnabled } from "../utils/ansi";
import { BaselineBotActionProvider } from "./action_providers";

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

type JsonSchemaObjectProperty = {
  type: string | string[];
  description: string;
  enum?: string[];
};

interface ToolLoopStepTrace {
  assistantText: string;
  toolCalls: Array<{
    id: string;
    name: string;
    rawArgs: string;
    toolResult: string;
    stop?: boolean;
    hasFinalAction?: boolean;
  }>;
}

interface ChatLike {
  chat(messages: ChatMessage[], options?: { signal?: AbortSignal }): Promise<string>;
  runToolLoop?<T>(
    messages: ChatMessage[],
    tools: ToolSchema[],
    callbacks: {
      onToolCall: (invocation: {
        id: string;
        name: string;
        args: Record<string, unknown>;
        rawArgs: string;
      }) => Promise<{
        toolResult: Record<string, unknown> | string;
        finalAction?: T;
        stop?: boolean;
      }>;
    },
    options?: {
      signal?: AbortSignal;
      maxSteps?: number;
      toolChoice?: "auto" | "required";
    },
  ): Promise<{
    finalAction: T | null;
    assistantText: string;
    thinkingTrace?: ToolLoopStepTrace[];
  }>;
}

/**
 * LLM 行为提供器配置项。
 */
export interface LlmActionProviderOptions {
  maxPromptEvents?: number;
  trace?: boolean;
  fallbackProvider?: ActionProvider;
  llmTimeoutMs?: number;
  colorizeLogs?: boolean;
  printLlmIo?: boolean;
  printThinking?: boolean;
}

/**
 * 真实 LLM 行为提供器：
 * - 将当前请求上下文转换为 JSON 协议提示词；
 * - 约束模型仅返回允许的工具调用；
 * - 解析失败或越权时自动降级到 fallback，确保对局可推进。
 */
export class LlmActionProvider implements ActionProvider {
  private readonly maxPromptEvents: number;
  private readonly trace: boolean;
  private readonly llmTimeoutMs: number;
  private readonly colorizeLogs: boolean;
  private readonly printLlmIo: boolean;
  private readonly printThinking: boolean;
  private readonly fallbackProvider: ActionProvider;
  private readonly recentEvents: string[] = [];
  private readonly agentHistories = new Map<EntityId, ChatMessage[]>();
  private readonly agentBroadcastCursor = new Map<EntityId, number>();

  constructor(
    private readonly world: World,
    private readonly client: ChatLike,
    options: LlmActionProviderOptions = {},
  ) {
    this.maxPromptEvents = options.maxPromptEvents ?? 16;
    this.trace = options.trace ?? false;
    this.llmTimeoutMs = options.llmTimeoutMs ?? 1200;
    this.colorizeLogs = isAnsiEnabled(options.colorizeLogs);
    this.printLlmIo = options.printLlmIo ?? false;
    this.printThinking = options.printThinking ?? false;
    this.fallbackProvider =
      options.fallbackProvider ?? new BaselineBotActionProvider(world);
  }

  static fromOpenAIClient(
    world: World,
    client: ChatLike,
    options: LlmActionProviderOptions = {},
  ): LlmActionProvider {
    return new LlmActionProvider(world, client, options);
  }

  /**
   * 执行一次动作决策：优先 SDK tool loop，失败时回退基线策略。
   */
  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const messages = this.buildMessages(request);
    let raw = "";
    const startedAt = Date.now();
    const effectiveTimeoutMs = this.computeEffectiveTimeout(request.deadlineAtMs);

    if (effectiveTimeoutMs <= 0) {
      this.appendTrace(
        `request_deadline_skip player=${request.actorId} phase=${request.phase}`,
      );
      return this.runFallback(request, "deadline_skip");
    }

    try {
      this.appendTrace(
        `request_start player=${request.actorId} phase=${request.phase} tools=${request.allowedTools.join(",")} timeout_ms=${effectiveTimeoutMs}`,
      );
      this.dumpLlmPrompt(messages, request);
      if (this.client.runToolLoop) {
        const runSdkAttempt = async (
          attempt: number,
          attemptMessages: ChatMessage[],
        ): Promise<{
          picked: ToolCall | null;
          failed: boolean;
          errorText?: string;
        }> => {
          try {
            const picked = await this.runSdkToolLoop(
              request,
              attemptMessages,
              effectiveTimeoutMs,
            );
            return { picked, failed: false };
          } catch (error) {
            const errorText = String(error);
            this.appendTrace(
              `request_sdk_attempt_fail player=${request.actorId} phase=${request.phase} attempt=${attempt} err=${errorText}`,
            );
            return { picked: null, failed: true, errorText };
          }
        };

        const firstAttempt = await runSdkAttempt(0, messages);
        const picked = firstAttempt.picked;
        if (picked) {
          this.appendTrace(
            `request_ok player=${request.actorId} phase=${request.phase} action=${picked.name} args=${JSON.stringify(picked.args)} elapsed_ms=${Date.now() - startedAt}`,
          );
          return picked;
        }
        if (this.isMustAct(request)) {
          let hasRuntimeError = firstAttempt.failed;
          let retryMessages = [...messages];
          const maxRetries = 3;
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const retryPrompt = this.buildMustActRetryPrompt(attempt, maxRetries);
            retryMessages = [
              ...retryMessages,
              {
                role: "user",
                content: retryPrompt,
              },
            ];
            console.log(
              `[LLM_RETRY] player=${request.actorId} phase=${request.phase} attempt=${attempt}/${maxRetries} reason=must_act_no_valid_action`,
            );
            this.dumpLlmPrompt(retryMessages, request);
            const retryResult = await runSdkAttempt(attempt, retryMessages);
            const retried = retryResult.picked;
            hasRuntimeError = hasRuntimeError || retryResult.failed;
            if (retried) {
              this.appendTrace(
                `request_ok_retry player=${request.actorId} phase=${request.phase} attempt=${attempt}/${maxRetries} action=${retried.name} args=${JSON.stringify(retried.args)} elapsed_ms=${Date.now() - startedAt}`,
              );
              return retried;
            }
          }
          if (hasRuntimeError) {
            return this.runFallback(request, "runtime_error");
          }
          return this.runFallback(request, "model_declined_required_action");
        }
        if (firstAttempt.failed) {
          return this.runFallback(request, "runtime_error");
        }
        this.appendTrace(
          `request_none player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt}`,
        );
        return null;
      } else {
        raw = await this.chatWithTimeout(messages, effectiveTimeoutMs);
        this.dumpLlmRawResponse(raw, request);
        const parsed = this.parseToolCall(raw, request.allowedTools);
        if (parsed) {
          this.appendTrace(
            `request_ok player=${request.actorId} phase=${request.phase} action=${parsed.name} args=${JSON.stringify(parsed.args)} elapsed_ms=${Date.now() - startedAt}`,
          );
          return parsed;
        }
        if (this.modelReturnedNone(raw)) {
          if (this.isMustAct(request)) {
            return this.runFallback(request, "model_declined_required_action");
          }
          this.appendTrace(
            `request_none player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt}`,
          );
          return null;
        }
        // 若模型已返回结构化 JSON（但工具越权或字段非法），必须走 fallback，
        // 不能被“文本恢复”逻辑改写，否则会绕过 allowedTools 约束。
        if (this.looksLikeStructuredToolJson(raw)) {
          return this.runFallback(request, "invalid_tool_json");
        }
        const repaired = this.recoverFromReasoningText(raw, request);
        if (repaired) {
          this.appendTrace(
            `request_ok_repaired player=${request.actorId} phase=${request.phase} action=${repaired.name} args=${JSON.stringify((repaired as any).args ?? {})} elapsed_ms=${Date.now() - startedAt}`,
          );
          return repaired;
        }
        return this.runFallback(request, "non_json_output");
      }
      return this.runFallback(request, "non_json_output");
    } catch (error) {
      const errText = String(error);
      if (errText.includes("llm_request_timeout_")) {
        this.appendTrace(
          `request_timeout player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt} err=${errText}`,
        );
      } else {
        this.appendTrace(
          `request_transport_fail player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt} err=${errText}`,
        );
      }
    }

    return this.runFallback(request, "runtime_error");
  }

  /**
   * mustAct 回合未产出有效动作时，返回递进式重试提示词。
   */
  private buildMustActRetryPrompt(attempt: number, maxRetries: number): string {
    if (attempt === 1) {
      return `上轮你没有完成有效工具调用。请立即调用一个可用工具，禁止解释文本。（重试 ${attempt}/${maxRetries}）`;
    }
    if (attempt === 2) {
      return `再次提醒：你必须立刻调用可用工具。不要输出思考、不要输出说明、不要输出自然语言。（重试 ${attempt}/${maxRetries}）`;
    }
    return `最后警告：若你本轮仍不调用可用工具，系统将判定失败并强制回退。现在立刻只输出函数调用。（重试 ${attempt}/${maxRetries}）`;
  }

  /**
   * 基于全局截止时间计算当前请求可用超时预算。
   */
  private computeEffectiveTimeout(deadlineAtMs?: number): number {
    if (!deadlineAtMs) {
      return this.llmTimeoutMs;
    }
    // 给后续阶段留一点缓冲，避免临界点抖动导致“刚超时又进入下一次请求”。
    const remainingMs = deadlineAtMs - Date.now() - 40;
    if (remainingMs <= 0) {
      return 0;
    }
    return Math.max(1, Math.min(this.llmTimeoutMs, remainingMs));
  }

  private async runFallback(
    request: ActionRequest,
    reason:
      | "non_json_output"
      | "runtime_error"
      | "deadline_skip"
      | "invalid_tool_json"
      | "model_declined_required_action" = "runtime_error",
  ): Promise<ToolCall | null> {
    // 降级策略：LLM 不可用或输出不合法时，使用基线策略保证对局继续。
    const fallbackAction = await this.fallbackProvider.getAction(request);
    this.dumpFallbackReason(request, reason, fallbackAction);
    if (fallbackAction) {
      this.appendTrace(
        `request_recovered player=${request.actorId} phase=${request.phase} reason=${reason} fallback=${fallbackAction.name} args=${JSON.stringify((fallbackAction as any).args ?? {})}`,
      );
    } else {
      this.appendTrace(
        `request_dropped player=${request.actorId} phase=${request.phase} reason=${reason}`,
      );
    }
    return fallbackAction;
  }

  /**
   * 输出降级原因日志，便于在非 trace 模式快速定位“为何出现默认兜底动作”。
   */
  private dumpFallbackReason(
    request: ActionRequest,
    reason: string,
    fallbackAction: ToolCall | null,
  ): void {
    const fallbackText = fallbackAction
      ? `${fallbackAction.name} ${JSON.stringify((fallbackAction as any).args ?? {})}`
      : "none";
    console.log(
      `[LLM_FALLBACK] player=${request.actorId} phase=${request.phase} reason=${reason} mustAct=${this.isMustAct(request)} allowedTools=${request.allowedTools.join(",")} fallback=${fallbackText}`,
    );
  }

  private async chatWithTimeout(
    messages: ChatMessage[],
    timeoutMs: number,
  ): Promise<string> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;
    try {
      return await Promise.race<string>([
        this.client.chat(messages, { signal: controller.signal }),
        new Promise<string>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`llm_request_timeout_${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async runSdkToolLoop(
    request: ActionRequest,
    messages: ChatMessage[],
    timeoutMs: number,
  ): Promise<ToolCall | null> {
    if (!this.client.runToolLoop) {
      return null;
    }
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;
    try {
      const tools = this.buildSdkToolSchemas(
        request.allowedTools,
        this.isMustAct(request),
      );
      const loop = this.client.runToolLoop<ToolCall>(
        messages,
        tools,
        {
          onToolCall: async (invocation) => {
            if (invocation.name === "finish_turn") {
              return {
                toolResult: { ok: true, reason: "turn_finished" },
                stop: true,
              };
            }

            if (!request.allowedTools.includes(invocation.name as ToolName)) {
              return {
                toolResult: {
                  ok: false,
                  error: "tool_not_allowed_in_this_turn",
                },
              };
            }

            const candidate: ToolCall = {
              name: invocation.name as ToolName,
              args: invocation.args as any,
            } as ToolCall;
            const parsed = this.parseToolCall(
              JSON.stringify(candidate),
              request.allowedTools,
            );
            if (!parsed) {
              return {
                toolResult: {
                  ok: false,
                  error: "invalid_tool_arguments",
                },
              };
            }

            return {
              toolResult: { ok: true, accepted: true },
              finalAction: parsed,
            };
          },
        },
        {
          signal: controller.signal,
          maxSteps: 8,
          toolChoice: this.isMustAct(request) ? "required" : "auto",
        },
      );

      const withTimeout = Promise.race([
        loop,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`llm_request_timeout_${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);

      const result = await withTimeout;
      if (result.assistantText) {
        this.appendAgentHistory(request.actorId, {
          role: "assistant",
          content: result.assistantText,
        });
      }
      this.dumpThinkingTrace(result.thinkingTrace ?? [], request);
      this.dumpLlmRawResponse(result.assistantText ?? "", request);
      return result.finalAction ?? null;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  /**
   * 为本回合可用工具构建 SDK 函数调用 schema。
   */
  private buildSdkToolSchemas(
    allowedTools: ToolName[],
    mustAct: boolean,
  ): ToolSchema[] {
    const tools: ToolSchema[] = allowedTools.map((tool) => this.toolSchema(tool));
    if (!mustAct) {
      tools.push({
        name: "finish_turn",
        description: "当你决定本回合不再继续行动时调用该工具。",
        parameters: {
          type: "object",
          properties: {},
          description: "空参数对象；调用后表示主动结束本回合。",
          additionalProperties: false,
        },
      });
    }
    return tools;
  }

  /**
   * 生成单个工具的参数 schema 定义。
   */
  private toolSchema(name: ToolName): ToolSchema {
    if (name === "speak") {
      return {
        name,
        description: "发送发言文本。",
        parameters: {
          type: "object",
          properties: {
            text: this.createProperty("string", "公开发言内容。"),
          },
          description: "白天公开发言参数。",
          required: ["text"],
          additionalProperties: false,
        },
      };
    }
    if (name === "speak_to_wolves") {
      return {
        name,
        description: "狼人夜聊发言；end_chat=true 表示发言后结束本人后续夜聊轮次。",
        parameters: {
          type: "object",
          properties: {
            text: this.createProperty("string", "狼人夜聊发言内容。"),
            end_chat: this.createProperty(
              "boolean",
              "是否在本次发言后结束本人后续夜聊轮次。",
            ),
          },
          description: "狼人夜聊发言参数。",
          required: ["text", "end_chat"],
          additionalProperties: false,
        },
      };
    }
    if (name === "kill_vote") {
      return {
        name,
        description: "狼人刀人投票。abstain=true 表示本狼人本轮弃刀（不提交目标）。",
        parameters: {
          type: "object",
          properties: {
            target_id: this.createProperty(
              ["number", "null"],
              "刀人目标玩家编号；弃刀时必须为 null。",
            ),
            abstain: this.createProperty(
              "boolean",
              "是否弃刀；true 时不提交目标且本票不计入刀人结算。",
            ),
          },
          description: "狼人刀人投票参数。",
          required: ["target_id", "abstain"],
          additionalProperties: false,
        },
      };
    }
    if (name === "guard") {
      return {
        name,
        description: "守卫守护目标。abstain=true 表示本轮空守。",
        parameters: {
          type: "object",
          properties: {
            target_id: this.createProperty(
              ["number", "null"],
              "守护目标玩家编号；空守时必须为 null。",
            ),
            abstain: this.createProperty(
              "boolean",
              "是否空守；true 时本轮不守护任何玩家。",
            ),
          },
          description: "守卫行动参数。",
          required: ["target_id", "abstain"],
          additionalProperties: false,
        },
      };
    }
    if (name === "vote") {
      return {
        name,
        description: "白天放逐投票。abstain=true 表示本轮弃票。",
        parameters: {
          type: "object",
          properties: {
            target_id: this.createProperty(
              ["number", "null"],
              "放逐目标玩家编号；弃票时必须为 null。",
            ),
            abstain: this.createProperty(
              "boolean",
              "是否弃票；true 时本票不参与放逐计票。",
            ),
          },
          description: "白天放逐投票参数。",
          required: ["target_id", "abstain"],
          additionalProperties: false,
        },
      };
    }
    if (
      name === "check_identity" ||
      name === "shoot"
    ) {
      return {
        name,
        description: "指定目标玩家执行行动。",
        parameters: {
          type: "object",
          properties: {
            target_id: this.createProperty("number", "目标玩家编号。"),
          },
          description: "目标玩家参数。",
          required: ["target_id"],
          additionalProperties: false,
        },
      };
    }
    if (name === "use_potion") {
      return {
        name,
        description: "女巫使用药剂。",
        parameters: {
          type: "object",
          properties: {
            target_id: this.createProperty("number", "药剂目标玩家编号。"),
            potion_type: {
              type: "string",
              enum: [PotionType.Heal, PotionType.Poison, PotionType.None],
              description:
                "药剂类型：heal=解药，poison=毒药，none=本轮不使用药剂。",
            },
          },
          description: "女巫用药参数。",
          required: ["target_id", "potion_type"],
          additionalProperties: false,
        },
      };
    }
    if (name === "self_destruct") {
      return {
        name,
        description: "狼人执行自爆。",
        parameters: {
          type: "object",
          properties: {
            reason: this.createProperty(
              "string",
              "自爆原因说明，仅用于日志与策略记录。",
            ),
          },
          description: "狼人自爆参数。",
          required: ["reason"],
          additionalProperties: false,
        },
      };
    }
    return {
      name,
      description: "警长选择发言方向。",
      parameters: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["clockwise", "counter_clockwise"],
            description:
              "发言方向：clockwise=顺时针，counter_clockwise=逆时针。",
          },
        },
        description: "警长定序参数。",
        required: ["direction"],
        additionalProperties: false,
      },
    };
  }

  private createProperty(
    type: string | string[],
    description: string,
    enumValues?: string[],
  ): JsonSchemaObjectProperty {
    const base: JsonSchemaObjectProperty = {
      type,
      description,
    };
    if (enumValues) {
      base.enum = enumValues;
    }
    return base;
  }

  /**
   * 将可见广播增量写入对应 agent 的消息历史。
   */
  private ingestBroadcastFeed(request: ActionRequest): void {
    const feed = this.extractBroadcastFeed(request.context);
    if (feed.length === 0) {
      return;
    }
    const cursor = this.agentBroadcastCursor.get(request.actorId) ?? 0;
    const delta = feed.slice(cursor);
    for (const line of delta) {
      this.appendAgentHistory(request.actorId, {
        role: "user",
        content: `【广播】${line}`,
      });
    }
    this.agentBroadcastCursor.set(request.actorId, feed.length);
  }

  /**
   * 从请求上下文提取广播消息列表。
   */
  private extractBroadcastFeed(context: Record<string, unknown>): string[] {
    const source = context.broadcast_feed ?? context.public_feed;
    if (!Array.isArray(source)) {
      return [];
    }
    return source.map((item) => String(item)).filter(Boolean);
  }

  /**
   * 追加 agent 历史消息并控制上限，避免上下文无限增长。
   */
  private appendAgentHistory(actorId: EntityId, message: ChatMessage): void {
    const history = this.agentHistories.get(actorId) ?? [];
    history.push(message);
    if (history.length > this.maxPromptEvents * 6) {
      history.splice(0, history.length - this.maxPromptEvents * 6);
    }
    this.agentHistories.set(actorId, history);
  }

  /**
   * 组装本轮发送给模型的完整消息序列。
   */
  private buildMessages(request: ActionRequest): ChatMessage[] {
    this.ingestBroadcastFeed(request);
    const role = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    const mustAct = this.isMustAct(request);
    const aliveIds = this.world.getAliveEntityIds();
    const knownAlive = aliveIds
      .map((id) => {
        const playerRole = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        const campHint =
          role?.role === "wolf" && playerRole?.camp === Camp.Wolf ? "wolf" : "unknown";
        return `${id}:${campHint}`;
      })
      .join(", ");

    const systemPrompt = [
      "你是狼人杀引擎中的单个玩家智能体。",
      "你必须使用中文进行思考和表达。",
      "你通过函数工具执行行动，不要手写 JSON。",
      `仅可调用本轮可用工具：${request.allowedTools.join(", ")}`,
      this.stageDirective(request),
      mustAct ? "本轮必须完成一次有效行动。" : "本轮可选择结束回合不行动。",
      mustAct
        ? "本轮禁止调用 finish_turn。"
        : "当你不需要继续行动时，请调用 finish_turn 工具结束回合。",
      "禁止输出思维链与额外元信息。",
    ].join("\n");

    const history = [...(this.agentHistories.get(request.actorId) ?? [])];
    const isInitialPrompt = history.length === 0;

    const userPrompt = [
      ...(isInitialPrompt ? [this.buildBoardInfoPrompt()] : []),
      `玩家编号=${request.actorId}`,
      `行动窗口=${request.actionWindow ?? "standard_round"}`,
      `mustAct=${mustAct}`,
      `你的身份=${role?.role ?? "unknown"}`,
      `可用工具=${JSON.stringify(request.allowedTools)}`,
      `存活玩家视图=${knownAlive}`,
      "你就是当前玩家，不要把其他玩家的身份当成你自己的身份。",
      this.toolArgHints(request.allowedTools),
      "请调用函数工具执行本回合动作。",
    ].join("\n");

    const currentTurnUser: ChatMessage = { role: "user", content: userPrompt };
    this.appendAgentHistory(request.actorId, currentTurnUser);

    return [
      { role: "system", content: systemPrompt },
      ...history,
      currentTurnUser,
    ];
  }

  /**
   * 首轮提示词中的板子信息：角色构成 + 技能简介。
   */
  private buildBoardInfoPrompt(): string {
    const counts = new Map<Role, number>();
    for (const id of this.world.entityIds()) {
      const roleComp = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      if (!roleComp) {
        continue;
      }
      counts.set(roleComp.role, (counts.get(roleComp.role) ?? 0) + 1);
    }

    const sortedRoles = Object.values(Role).filter((role) => (counts.get(role) ?? 0) > 0);
    const lineup = sortedRoles
      .map((role) => `${this.roleLabel(role)}x${counts.get(role) ?? 0}`)
      .join("，");
    const skillBriefs = sortedRoles
      .map(
        (role) =>
          `${this.roleLabel(role)}：${this.roleSkillBrief(role)}`,
      )
      .join("；");

    return [
      "当前板子信息：",
      `总玩家数=${this.world.entityIds().length}`,
      `角色构成=${lineup || "unknown"}`,
      `角色技能简介=${skillBriefs || "unknown"}`,
    ].join("\n");
  }

  private roleLabel(role: Role): string {
    if (role === Role.Wolf) {
      return "狼人";
    }
    if (role === Role.Villager) {
      return "平民";
    }
    if (role === Role.Seer) {
      return "预言家";
    }
    if (role === Role.Guard) {
      return "守卫";
    }
    if (role === Role.Witch) {
      return "女巫";
    }
    if (role === Role.Hunter) {
      return "猎人";
    }
    if (role === Role.Idiot) {
      return "白痴";
    }
    return role;
  }

  private roleSkillBrief(role: Role): string {
    if (role === Role.Wolf) {
      return "夜间可狼队夜聊并参与刀人投票";
    }
    if (role === Role.Villager) {
      return "无夜间技能，白天通过发言和投票推进局势";
    }
    if (role === Role.Seer) {
      return "每晚可查验一名玩家阵营";
    }
    if (role === Role.Guard) {
      return "每晚可守护一名玩家，通常不可连续同守";
    }
    if (role === Role.Witch) {
      return "拥有解药与毒药，可在夜间选择使用";
    }
    if (role === Role.Hunter) {
      return "满足条件时可开枪带走一名玩家";
    }
    if (role === Role.Idiot) {
      return "白天被放逐可翻牌免死并失去投票权";
    }
    return "请按当前规则解释该角色技能";
  }

  /**
   * 针对关键子阶段给出强约束指令，减少“狼聊阶段误当投票阶段”等误解。
   */
  private stageDirective(request: ActionRequest): string {
    const tools = request.allowedTools;
    if (tools.includes("speak_to_wolves")) {
      return "当前是【狼人交流阶段】：只能调用 speak_to_wolves。若你想结束后续夜聊，请在该工具中设置 end_chat=true；本阶段不会完成刀人。";
    }
    if (tools.length === 1 && tools[0] === "kill_vote") {
      return "当前是【狼人刀人投票阶段】：必须调用 kill_vote；若本轮决定不刀，请设置 abstain=true 且 target_id=null。";
    }
    if (tools.length === 1 && tools[0] === "use_potion") {
      return `当前是【女巫行动阶段】：必须调用 use_potion；若本夜不用药，调用 use_potion 并设置 potion_type="${PotionType.None}"。`;
    }
    return "请严格区分当前阶段职责，只执行本轮工具对应动作。";
  }

  /**
   * 生成可用工具参数提示文本。
   */
  private toolArgHints(allowedTools: string[]): string {
    const hints: string[] = [];
    if (allowedTools.includes("speak")) {
      hints.push('speak args: {"text":"..."}');
    }
    if (allowedTools.includes("speak_to_wolves")) {
      hints.push('speak_to_wolves args: {"text":"...","end_chat":true|false}');
    }
    if (allowedTools.includes("kill_vote")) {
      hints.push('kill_vote args: {"target_id":number|null,"abstain":true|false}');
    }
    if (allowedTools.includes("guard")) {
      hints.push('guard args: {"target_id":number|null,"abstain":true|false}');
    }
    if (allowedTools.includes("check_identity")) {
      hints.push('check_identity args: {"target_id":number}');
    }
    if (allowedTools.includes("vote")) {
      hints.push('vote args: {"target_id":number|null,"abstain":true|false}');
    }
    if (allowedTools.includes("shoot")) {
      hints.push('shoot args: {"target_id":number}');
    }
    if (allowedTools.includes("self_destruct")) {
      hints.push('self_destruct args: {"reason":"..."}');
    }
    if (allowedTools.includes("choose_direction")) {
      hints.push(
        'choose_direction args: {"direction":"clockwise"|"counter_clockwise"}',
      );
    }
    if (allowedTools.includes("use_potion")) {
      hints.push(
        `use_potion args: {"target_id":number,"potion_type":"${PotionType.Heal}"|"${PotionType.Poison}"|"${PotionType.None}"}`,
      );
    }
    return `工具参数提示=${hints.join("; ")}`;
  }

  private parseToolCall(
    raw: string,
    allowedTools: ActionRequest["allowedTools"],
  ): ToolCall | null {
    const json = this.extractJson(raw);
    if (!json) {
      return null;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (parsed.name === "none") {
      return null;
    }
    if (typeof parsed.name !== "string" || !allowedTools.includes(parsed.name)) {
      return null;
    }
    if (!parsed.args || typeof parsed.args !== "object") {
      parsed.args = {};
    }

    // 仅做最小字段纠正，详细规则由 ToolGateway 二次校验。
    if (["check_identity", "shoot"].includes(parsed.name)) {
      parsed.args.target_id = Number(parsed.args.target_id);
    }
    if (parsed.name === "guard" || parsed.name === "vote") {
      parsed.args.abstain = Boolean(parsed.args.abstain);
      if (parsed.args.abstain) {
        parsed.args.target_id = null;
      } else {
        const target = Number(parsed.args.target_id);
        if (!Number.isFinite(target)) {
          return null;
        }
        parsed.args.target_id = target;
      }
    }
    if (parsed.name === "kill_vote") {
      parsed.args.abstain = Boolean(parsed.args.abstain);
      if (parsed.args.abstain) {
        parsed.args.target_id = null;
      } else {
        const target = Number(parsed.args.target_id);
        if (!Number.isFinite(target)) {
          return null;
        }
        parsed.args.target_id = target;
      }
    }

    if (parsed.name === "use_potion") {
      parsed.args.target_id = Number(parsed.args.target_id);
      if (
        ![PotionType.Heal, PotionType.Poison, PotionType.None].includes(
          parsed.args.potion_type,
        )
      ) {
        return null;
      }
    }

    if (parsed.name === "choose_direction") {
      if (
        !["clockwise", "counter_clockwise"].includes(parsed.args.direction)
      ) {
        return null;
      }
    }

    if (parsed.name === "speak_to_wolves") {
      parsed.args.end_chat = Boolean(parsed.args.end_chat);
    }

    return parsed as ToolCall;
  }

  /**
   * 从模型原始文本中提取最可能的工具调用 JSON 片段。
   */
  private extractJson(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    const withoutThink = trimmed.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const candidates = [trimmed, withoutThink];
    for (const text of candidates) {
      // 允许模型偶发输出 ```json ... ```，这里提取代码块内部 JSON。
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch?.[1]) {
        const fenced = fenceMatch[1].trim();
        if (fenced.includes('"name"')) {
          return fenced;
        }
      }

      const braceCandidates = this.collectBalancedJsonObjects(text);
      for (const candidate of braceCandidates) {
        if (candidate.includes('"name"') && candidate.includes('"args"')) {
          return candidate;
        }
      }
    }

    return null;
  }

  /**
   * 判断响应是否为结构化工具 JSON（即使内容非法）。
   */
  private looksLikeStructuredToolJson(raw: string): boolean {
    const json = this.extractJson(raw);
    if (!json) {
      return false;
    }
    try {
      const parsed = JSON.parse(json);
      return (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.name === "string" &&
        parsed.args !== undefined
      );
    } catch {
      return false;
    }
  }

  /**
   * 判断模型是否显式返回 `none`。
   */
  private modelReturnedNone(raw: string): boolean {
    const json = this.extractJson(raw);
    if (!json) {
      return false;
    }
    try {
      const parsed = JSON.parse(json);
      return parsed?.name === "none";
    } catch {
      return false;
    }
  }

  /**
   * 判断当前请求是否必须行动。
   */
  private isMustAct(request: ActionRequest): boolean {
    return request.context.must_act === true;
  }

  /**
   * 收集文本中括号平衡的 JSON 对象候选。
   */
  private collectBalancedJsonObjects(text: string): string[] {
    const out: string[] = [];
    const stack: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === "{") {
        stack.push(i);
      } else if (ch === "}") {
        const start = stack.pop();
        if (start !== undefined) {
          out.push(text.slice(start, i + 1));
        }
      }
    }
    // 优先返回后出现的对象，通常更接近模型最终答案。
    return out.reverse();
  }

  /**
   * 当模型输出 <think> 或自然语言而非 JSON 时，
   * 尝试按“当前允许工具”进行恢复解析，尽量避免直接判定失败。
   */
  private recoverFromReasoningText(
    raw: string,
    request: ActionRequest,
  ): ToolCall | null {
    const cleaned = raw
      .replace(/<think>/gi, "")
      .replace(/<\/think>/gi, "")
      .replace(/```[\s\S]*?```/g, "")
      .trim();
    if (!cleaned) {
      return null;
    }

    const allowed = request.allowedTools;
    if (allowed.length === 1 && allowed[0] === "speak_to_wolves") {
      const lower = cleaned.toLowerCase();
      const shouldEndChat =
        lower.includes("结束夜聊") ||
        lower.includes("结束群聊") ||
        lower.includes("停止夜聊") ||
        lower.includes("end_chat");
      return {
        name: "speak_to_wolves",
        args: {
          text: this.toSpeakText(cleaned),
          end_chat: shouldEndChat,
        },
      };
    }
    if (allowed.length !== 1) {
      return null;
    }

    const tool = allowed[0];
    const targetId = this.extractTargetId(cleaned, request.actorId);

    if (tool === "speak") {
      return {
        name: tool,
        args: {
          text: this.toSpeakText(cleaned),
        },
      } as ToolCall;
    }

    if (tool === "choose_direction") {
      const lower = cleaned.toLowerCase();
      const direction =
        lower.includes("counter_clockwise") ||
        lower.includes("counterclockwise") ||
        lower.includes("逆时针") ||
        lower.includes("警右")
          ? "counter_clockwise"
          : "clockwise";
      return {
        name: "choose_direction",
        args: { direction },
      };
    }

    if (tool === "self_destruct") {
      return {
        name: "self_destruct",
        args: { reason: "recovered_from_reasoning_text" },
      };
    }

    if (tool === "use_potion") {
      const potion = this.extractPotion(cleaned);
      const fallbackTarget = this.pickAliveNotSelf(request.actorId);
      return {
        name: "use_potion",
        args: {
          target_id: targetId ?? fallbackTarget ?? request.actorId,
          potion_type: potion,
        },
      };
    }

    if (tool === "kill_vote") {
      const lower = cleaned.toLowerCase();
      const abstain =
        lower.includes("不刀") ||
        lower.includes("弃刀") ||
        lower.includes("不投刀") ||
        lower.includes("abstain");
      if (abstain) {
        return {
          name: "kill_vote",
          args: { target_id: null, abstain: true },
        };
      }
      const resolvedTarget = targetId ?? this.pickAliveNotSelf(request.actorId);
      if (resolvedTarget === null) {
        return {
          name: "kill_vote",
          args: { target_id: null, abstain: true },
        };
      }
      return {
        name: "kill_vote",
        args: { target_id: resolvedTarget, abstain: false },
      };
    }

    if (tool === "guard" || tool === "vote") {
      const lower = cleaned.toLowerCase();
      const abstain =
        lower.includes("空守") ||
        lower.includes("不守") ||
        lower.includes("弃票") ||
        lower.includes("不投票") ||
        lower.includes("abstain");
      if (abstain) {
        return {
          name: tool as any,
          args: { target_id: null, abstain: true },
        };
      }
      const resolvedTarget = targetId ?? this.pickAliveNotSelf(request.actorId);
      if (resolvedTarget === null) {
        return {
          name: tool as any,
          args: { target_id: null, abstain: true },
        };
      }
      return {
        name: tool as any,
        args: { target_id: resolvedTarget, abstain: false },
      };
    }

    if (["check_identity", "shoot"].includes(tool)) {
      const resolvedTarget = targetId ?? this.pickAliveNotSelf(request.actorId);
      if (resolvedTarget === null) {
        return null;
      }
      return {
        name: tool as any,
        args: { target_id: resolvedTarget },
      };
    }

    return null;
  }

  /**
   * 从自然语言中提取目标玩家编号。
   */
  private extractTargetId(text: string, actorId: EntityId): EntityId | null {
    const patterns = [
      /target[_\s-]*id[^0-9]*(\d+)/gi,
      /目标[^0-9]*(\d+)/gi,
      /player[^0-9]*(\d+)/gi,
      /玩家[^0-9]*(\d+)/gi,
    ];
    for (const pattern of patterns) {
      let match: RegExpExecArray | null = null;
      while ((match = pattern.exec(text)) !== null) {
        const candidate = Number(match[1]);
        if (Number.isFinite(candidate) && candidate !== actorId) {
          return candidate;
        }
      }
    }
    return null;
  }

  /**
   * 清洗并规范化发言文本，过滤提示词回显污染。
   */
  private toSpeakText(text: string): string {
    const withoutMetaLines = text
      .split(/\r?\n/)
      .filter((line) => {
        const lower = line.trim().toLowerCase();
        if (!lower) {
          return false;
        }
        // 过滤掉模型把提示词原样复述成发言内容的污染行。
        return ![
          "actorid=",
          "玩家编号=",
          "phase=",
          "当前阶段=",
          "actionwindow=",
          "行动窗口=",
          "role=",
          "你的身份=",
          "allowedtools=",
          "可用工具=",
          "context=",
          "阶段上下文=",
          "aliveplayers=",
          "存活玩家视图=",
          "私有查验情报=",
          "toolarghints=",
          "工具参数提示=",
          "你是狼人杀引擎中的单个玩家智能体",
          "json 格式",
        ].some((keyword) => lower.includes(keyword));
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
    const seemsPromptEcho =
      lower.includes("actorid") ||
      lower.includes("allowedtools") ||
      lower.includes("actionwindow") ||
      lower.includes("可用工具") ||
      lower.includes("行动窗口") ||
      lower.includes("阶段上下文") ||
      lower.includes("json") ||
      lower.includes("tool");

    if (!cleaned || cleaned.length < 4 || seemsPromptEcho) {
      return "我先听后位发言再判断。";
    }
    return cleaned.slice(0, 120);
  }

  /**
   * 从自然语言中推断女巫药剂类型。
   */
  private extractPotion(text: string): PotionType {
    const lower = text.toLowerCase();
    if (
      lower.includes(PotionType.Poison) ||
      lower.includes("毒") ||
      lower.includes("poison")
    ) {
      return PotionType.Poison;
    }
    if (
      lower.includes(PotionType.Heal) ||
      lower.includes("救") ||
      lower.includes("heal")
    ) {
      return PotionType.Heal;
    }
    return PotionType.None;
  }

  /**
   * 选择任意存活且非自己的目标。
   */
  private pickAliveNotSelf(actorId: EntityId): EntityId | null {
    const alive = this.world.getAliveEntityIds();
    const target = alive.find((id) => id !== actorId);
    return target ?? null;
  }

  /**
   * 记录并输出 provider 追踪日志。
   */
  private appendTrace(line: string): void {
    this.recentEvents.push(line);
    if (this.recentEvents.length > 80) {
      this.recentEvents.shift();
    }
    if (this.trace) {
      console.log(this.decorateTrace(line));
    }
  }

  /**
   * 按日志类型为 trace 添加颜色与前缀。
   */
  private decorateTrace(line: string): string {
    const prefix = "[LLMActionProvider]";
    if (!this.colorizeLogs) {
      return `${prefix} ${line}`;
    }
    if (line.includes("request_ok")) {
      return `${colorize(prefix, "ok", true)} ${colorize(line, "ok", true)}`;
    }
    if (line.includes("request_recovered")) {
      return `${colorize(prefix, "warn", true)} ${colorize(line, "warn", true)}`;
    }
    if (line.includes("request_timeout")) {
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

  /**
   * 在 `printLlmIo` 打开时输出提示词内容。
   */
  private dumpLlmPrompt(messages: ChatMessage[], request: ActionRequest): void {
    if (!this.printLlmIo) {
      return;
    }
    const prefix = colorize("[LLM_IO]", "accent", this.colorizeLogs);
    const marker = `player=${request.actorId} phase=${request.phase}`;
    console.log(`${prefix} prompt_start ${marker}`);
    for (const msg of messages) {
      const roleTag = msg.role === "system" ? "system" : msg.role === "user" ? "user" : "assistant";
      console.log(`${prefix} prompt_${roleTag}: ${msg.content}`);
    }
    console.log(`${prefix} prompt_end ${marker}`);
  }

  /**
   * 在 `printLlmIo` 打开时输出模型原始响应。
   */
  private dumpLlmRawResponse(raw: string, request: ActionRequest): void {
    if (!this.printLlmIo) {
      return;
    }
    const prefix = colorize("[LLM_IO]", "accent", this.colorizeLogs);
    const marker = `player=${request.actorId} phase=${request.phase}`;
    console.log(`${prefix} raw_response_start ${marker}`);
    console.log(`${prefix} raw_response: ${raw}`);
    console.log(`${prefix} raw_response_end ${marker}`);
  }

  private dumpThinkingTrace(
    trace: ToolLoopStepTrace[],
    request: ActionRequest,
  ): void {
    if (!this.printThinking || trace.length === 0) {
      return;
    }
    const prefix = colorize("[THINKING]", "muted", this.colorizeLogs);
    const marker = `player=${request.actorId} phase=${request.phase}`;
    console.log(`${prefix} start ${marker}`);
    for (const [stepIndex, step] of trace.entries()) {
      if (step.assistantText && step.assistantText.trim().length > 0) {
        console.log(
          `${prefix} assistant step=${stepIndex + 1}: ${step.assistantText}`,
        );
      }
      for (const call of step.toolCalls) {
        console.log(
          `${prefix} tool_call step=${stepIndex + 1} id=${call.id} name=${call.name} args=${call.rawArgs}`,
        );
        console.log(
          `${prefix} tool_result step=${stepIndex + 1} id=${call.id} result=${call.toolResult}`,
        );
      }
    }
    console.log(`${prefix} end ${marker}`);
  }
}
