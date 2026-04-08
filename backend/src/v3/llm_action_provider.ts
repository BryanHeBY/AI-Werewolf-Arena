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
} from "../domain/model";
import { World } from "../domain/world";
import { ChatMessage, OpenAIClient } from "../infra/llm/openai_client";
import { colorize, isAnsiEnabled } from "../utils/ansi";
import { BaselineBotActionProvider } from "./action_providers";

interface ChatLike {
  chat(messages: ChatMessage[], options?: { signal?: AbortSignal }): Promise<string>;
}

export interface LlmActionProviderOptions {
  maxPromptEvents?: number;
  trace?: boolean;
  fallbackProvider?: ActionProvider;
  llmTimeoutMs?: number;
  colorizeLogs?: boolean;
  printLlmIo?: boolean;
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
  private readonly fallbackProvider: ActionProvider;
  private readonly recentEvents: string[] = [];

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
    this.fallbackProvider =
      options.fallbackProvider ?? new BaselineBotActionProvider(world);
  }

  static fromOpenAIClient(
    world: World,
    client: OpenAIClient,
    options: LlmActionProviderOptions = {},
  ): LlmActionProvider {
    return new LlmActionProvider(world, client, options);
  }

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

  private buildMessages(request: ActionRequest): ChatMessage[] {
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
      "你必须且只能返回 JSON，禁止 Markdown。",
      "JSON 格式：{\"name\":\"tool_name|none\",\"args\":{...}}",
      `仅可从可用工具中选择：${request.allowedTools.join(", ")}`,
      mustAct
        ? "本轮必须行动（mustAct=true），禁止返回 none。"
        : "若不行动请返回：{\"name\":\"none\",\"args\":{}}",
      "禁止输出 <think>、思维链、解释文本、代码块。",
      "禁止编造额外字段。",
    ].join("\n");

    const userPrompt = [
      `玩家编号=${request.actorId}`,
      `当前阶段=${request.phase}`,
      `行动窗口=${request.actionWindow ?? "standard_round"}`,
      `mustAct=${mustAct}`,
      `你的身份=${role?.role ?? "unknown"}`,
      `可用工具=${JSON.stringify(request.allowedTools)}`,
      `阶段上下文=${JSON.stringify(request.context)}`,
      this.publicFeedLine(request),
      `存活玩家视图=${knownAlive}`,
      this.seerPrivateIntelLine(request.actorId),
      "你就是当前玩家，不要把其他玩家的身份当成你自己的身份。",
      this.toolArgHints(request.allowedTools),
      "现在立刻输出 JSON（单行）：{\"name\":\"...\",\"args\":{...}}",
    ].join("\n");

    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];
  }

  private seerPrivateIntelLine(actorId: EntityId): string {
    const role = this.world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
    if (!role || role.role !== Role.Seer || !role.seerState) {
      return "私有查验情报=无";
    }
    const lastTarget = role.seerState.lastTarget;
    const lastIsWerewolf = role.seerState.lastIsWerewolf;
    if (lastTarget === null || lastIsWerewolf === null) {
      return "私有查验情报=无";
    }
    return `私有查验情报=你最近一次查验：${lastTarget}号是${lastIsWerewolf ? "狼人" : "好人"}`;
  }

  private publicFeedLine(request: ActionRequest): string {
    const feed = request.context.public_feed;
    if (!Array.isArray(feed) || feed.length === 0) {
      return "公开信息摘要=无";
    }
    return `公开信息摘要=${feed.join(" | ")}`;
  }

  private toolArgHints(allowedTools: string[]): string {
    const hints: string[] = [];
    if (allowedTools.includes("speak")) {
      hints.push('speak args: {"text":"..."}');
    }
    if (allowedTools.includes("speak_to_wolves")) {
      hints.push('speak_to_wolves args: {"text":"..."}');
    }
    if (allowedTools.includes("kill_vote")) {
      hints.push('kill_vote args: {"target_id":number}');
    }
    if (allowedTools.includes("guard")) {
      hints.push('guard args: {"target_id":number}');
    }
    if (allowedTools.includes("check_identity")) {
      hints.push('check_identity args: {"target_id":number}');
    }
    if (allowedTools.includes("vote")) {
      hints.push('vote args: {"target_id":number}');
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
    if (
      ["guard", "kill_vote", "check_identity", "vote", "shoot"].includes(parsed.name)
    ) {
      parsed.args.target_id = Number(parsed.args.target_id);
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

    return parsed as ToolCall;
  }

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

  private isMustAct(request: ActionRequest): boolean {
    return request.context.must_act === true;
  }

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
    if (allowed.length !== 1) {
      return null;
    }

    const tool = allowed[0];
    const targetId = this.extractTargetId(cleaned, request.actorId);

    if (tool === "speak" || tool === "speak_to_wolves") {
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

    if (["guard", "kill_vote", "check_identity", "vote", "shoot"].includes(tool)) {
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

  private pickAliveNotSelf(actorId: EntityId): EntityId | null {
    const alive = this.world.getAliveEntityIds();
    const target = alive.find((id) => id !== actorId);
    return target ?? null;
  }

  private appendTrace(line: string): void {
    this.recentEvents.push(line);
    if (this.recentEvents.length > 80) {
      this.recentEvents.shift();
    }
    if (this.trace) {
      console.log(this.decorateTrace(line));
    }
  }

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
}
