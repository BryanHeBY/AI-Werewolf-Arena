/**
 * 将玩家提示、模型原文和工具轨迹输出到终端，按选项控制日志、思考内容及着色。
 * 输入为编排器已提供的数据；输出只有日志与诊断文本，不负责事件投影、持久化或行动判定。
 * 文案依据 locale 渲染，机器标签及模型原文保持原值；console 异常仍交给调用方处理。
 */
import { text, dictionaries, type MessageKey, type Locale } from "@ai-werewolf-arena/game-text";
import { ActionRequest } from "../../../domain";
import { colorize, isAnsiEnabled } from "../../../utils/ansi";
import { ChatMessage, ToolLoopStepTrace } from "../../integrations/llm/transport";

/** 仅控制日志展示；printThinking 不创建思考结果，transport 只选择原标签，locale 不改变模型原文。 */
export interface LlmObserverOptions {
  trace: boolean;
  locale?: Locale;
  colorizeLogs?: boolean;
  printLlmIo: boolean;
  printThinking: boolean;
  transport?: "llm" | "acp";
}

/** 终端观察与游戏决策分离；最近 80 条 trace 由本实例持有。 */
export class LlmObserver {
  private readonly recentEvents: string[] = [];
  private readonly colorizeLogs: boolean;

  constructor(private readonly options: LlmObserverOptions) {
    this.colorizeLogs = isAnsiEnabled(options.colorizeLogs);
  }

  get locale(): Locale {
    return this.options.locale ?? "zh-CN";
  }

  // 先记原 line 并裁到最近 80 条，再决定是否打印；装饰／console 失败不会撤回已改缓冲。
  trace(line: string): void {
    this.recentEvents.push(line);
    if (this.recentEvents.length > 80) this.recentEvents.shift();
    if (this.options.trace) console.log(this.decorate(line));
  }

  /** 原调用方负责可见数据范围；此处只按消息顺序打印，未知 role 显示原标签，不自行过滤或转交行动。 */
  prompt(messages: ChatMessage[], request: ActionRequest): void {
    if (!this.options.printLlmIo) return;
    const prefix = colorize(
      this.options.transport === "acp" ? "[ACP_IO]" : "[LLM_IO]",
      "accent",
      this.colorizeLogs,
    );
    const marker = `player=${request.actorId} phase=${request.phase}`;
    console.log(`${prefix} prompt_start ${marker} · ${text(this.locale, "runtime.prompt_start")}`);
    for (const msg of messages) {
      const roleTag = typeof msg.role === "string" ? msg.role : "unknown";
      const roleKey = `runtime.prompt_${roleTag}` as MessageKey;
      const roleLabel = Object.hasOwn(dictionaries[this.locale], roleKey)
        ? text(this.locale, roleKey)
        : roleTag;
      console.log(`${prefix} prompt_${roleTag} · ${roleLabel}: ${msg.content}`);
    }
    console.log(`${prefix} prompt_end ${marker} · ${text(this.locale, "runtime.prompt_end")}`);
  }

  /** 原回应不解析成工具；打印开关关闭则早返，日志／翻译错误保持原抛出，不变成请求校验结果。 */
  rawResponse(raw: string, request: ActionRequest): void {
    if (!this.options.printLlmIo) return;
    const prefix = colorize(
      this.options.transport === "acp" ? "[ACP_IO]" : "[LLM_IO]",
      "accent",
      this.colorizeLogs,
    );
    const marker = `player=${request.actorId} phase=${request.phase}`;
    console.log(
      `${prefix} raw_response_start ${marker} · ${text(this.locale, "runtime.raw_response_start")}`,
    );
    console.log(`${prefix} raw_response · ${text(this.locale, "runtime.raw_response")}: ${raw}`);
    console.log(
      `${prefix} raw_response_end ${marker} · ${text(this.locale, "runtime.raw_response_end")}`,
    );
  }

  /** 按原 step 和 toolCalls 顺序展示文本与原工具轨迹；不由 accepted 字段推断资源付款或隐藏信息许可。 */
  thinking(trace: ToolLoopStepTrace[], request: ActionRequest): void {
    if (!this.options.printThinking || trace.length === 0) return;
    const prefix = colorize("[THINKING]", "muted", this.colorizeLogs);
    const marker = `player=${request.actorId} phase=${request.phase}`;
    console.log(`${prefix} start ${marker} · ${text(this.locale, "runtime.thinking_start")}`);
    for (const [stepIndex, step] of trace.entries()) {
      if (step.assistantText?.trim()) {
        console.log(
          `${prefix} assistant step=${stepIndex + 1} · ${text(this.locale, "runtime.assistant_output")}: ${step.assistantText}`,
        );
      }
      for (const call of step.toolCalls) {
        console.log(
          `${prefix} ${text(this.locale, "runtime.tool_call")} | tool_call step=${stepIndex + 1} id=${call.id} name=${call.name} args=${call.rawArgs}`,
        );
        console.log(
          `${prefix} ${text(this.locale, "runtime.tool_result")} | tool_result step=${stepIndex + 1} id=${call.id} result=${call.toolResult}`,
        );
      }
    }
    console.log(`${prefix} end ${marker} · ${text(this.locale, "runtime.thinking_end")}`);
  }

  /** 诊断摘要优先采用最终文本，否则取最后一条非空步骤文本；仅摘要截断，原始日志不由此改写。 */
  thinkingText(assistantText: string, trace: ToolLoopStepTrace[]): string | null {
    const primary = assistantText.trim();
    if (primary) return primary.length > 1200 ? `${primary.slice(0, 1200)}…` : primary;
    for (let i = trace.length - 1; i >= 0; i--) {
      const text = trace[i]?.assistantText?.trim();
      if (text) return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
    }
    return null;
  }

  // 只按原首 token 查展示 key，再按包含的机器标签选颜色；没有解码事件或改变原 line 的诊断含义。
  private decorate(line: string): string {
    const prefix = this.options.transport === "acp" ? "[ACPActionProvider]" : "[LLMActionProvider]";
    const key = `runtime.trace.${line.split(" ", 1)[0]}` as MessageKey;
    if (Object.hasOwn(dictionaries[this.locale], key)) line = `${text(this.locale, key)} | ${line}`;
    if (!this.colorizeLogs) return `${prefix} ${line}`;
    if (line.includes("request_ok"))
      return `${colorize(prefix, "ok", true)} ${colorize(line, "ok", true)}`;
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
