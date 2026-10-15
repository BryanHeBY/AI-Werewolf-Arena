/**
 * 负责终端游戏事件、结果与 ACP 增量输出。输入为已投影事件、运行摘要、ACP 更新与输出选项；输出为原文本和着色日志。
 * 副作用为同步调用原 log／console；每个 ACP logger 只保存本玩家的文本片段与工具显示状态，不落盘或提交游戏行动。
 * 本模块不计算请求期限或发起取消；会话关闭与超时由运行调用方处理，flush 仅输出本地尾段并清空工具显示缓存。
 * 分段、去重与输出调用保原顺序；渲染、字段读取或日志抛错仍向调用方传播，不在此回滚已输出内容。
 */
import { formatErrorDiagnostic } from "../../utils/error-diagnostic";
import { text, dictionaries, type MessageKey, type Locale } from "@ai-werewolf-arena/game-text";
import {
  outcomeLabel,
  outcomeWinnersLabel,
  victoryPointLabel,
} from "@ai-werewolf-arena/game-presentation";
import { getDefaultScriptEventRenderRegistry } from "../../engine/game-api";
import type { GameEvent, RuntimeSnapshot } from "../../domain";
import { colorize, isAnsiEnabled } from "../../utils/ansi";

export type ConsoleTone = "muted" | "info" | "ok" | "warn" | "error" | "accent" | "god";
export type ConsoleLog = (text: string, tone?: ConsoleTone) => void;

export function toChatLines(events: readonly GameEvent[], locale: Locale = "zh-CN"): string[] {
  const registry = getDefaultScriptEventRenderRegistry();
  return events.flatMap((event) => {
    const line = registry.toChatLine(event, locale);
    return line ? [line] : [];
  });
}

export function createConsoleLog(color: boolean): ConsoleLog {
  const enabled = isAnsiEnabled(color);
  return (text, tone = "info") => console.log(colorize(text, tone, enabled));
}

// 角色与机制可复用不带终端标签的展示文案；按已有输出分类统一补直播前缀。
const livePrefixKeys = {
  chat: "console.live.chat",
  action: "console.live.action",
  private: "console.live.private",
  god: "console.live.god",
  system: "console.live.god",
  end: "console.live.god",
} as const;

export function presentStreamEvents(
  events: readonly GameEvent[],
  printPrivateEvents: boolean,
  log: ConsoleLog,
  locale: Locale = "zh-CN",
): void {
  const registry = getDefaultScriptEventRenderRegistry();
  for (const event of events) {
    for (const render of registry.toLiveRender(event, printPrivateEvents, locale)) {
      const tone =
        render.kind === "chat"
          ? "accent"
          : render.kind === "private"
            ? "warn"
            : render.kind === "action"
              ? "info"
              : render.kind === "god"
                ? "god"
                : "ok";
      // 旧贡献已含席位、阶段等专用标签，原样保留，避免重复前缀或改写玩家发言。
      // God 分类还包括公开公告；仅明确的空受众事实使用“上帝私有”，不从分类反推权限。
      const prefixKey =
        render.kind === "god" && "audience" in event && event.audience?.length === 0
          ? "console.live.god_private"
          : livePrefixKeys[render.kind];
      const line = render.text.startsWith("[live]")
        ? render.text
        : text(locale, prefixKey, { line: render.text });
      log(line, tone);
    }
  }
}

export function presentGameResult(input: {
  locale?: Locale;
  board: string;
  snapshot: RuntimeSnapshot;
  events: readonly GameEvent[];
  timedOut: boolean;
  printAllEvents: boolean;
  printChat: boolean;
  streamEvents: boolean;
  log: ConsoleLog;
}): void {
  const { board, snapshot, events, timedOut, log } = input;
  log(
    `[run_game] done board=${board} gameOver=${snapshot.gameOver} day=${snapshot.day} winner=${snapshot.result?.winner ?? "none"} timedOut=${timedOut} · ${text(input.locale ?? "zh-CN", "runtime.done")}`,
    "ok",
  );
  log(
    `[run_game] events=${events.length} · ${text(input.locale ?? "zh-CN", "runtime.event_count")}`,
    "info",
  );
  if (snapshot.result) {
    const locale = input.locale ?? "zh-CN";
    log(
      `[result] ${outcomeLabel(snapshot.result.outcome, locale)} · ${outcomeWinnersLabel(snapshot.result.outcome, locale)} · ${victoryPointLabel(snapshot.result.decidedAt, locale)}`,
      "ok",
    );
  }
  if (input.printAllEvents) console.log(JSON.stringify(events, null, 2));
  if (input.printChat && !input.streamEvents) {
    for (const line of toChatLines(events, input.locale)) console.log(line);
  }
}

type AcpUpdateRecord = Record<string, unknown>;
function asRecord(value: unknown): AcpUpdateRecord | null {
  return value && typeof value === "object" ? (value as AcpUpdateRecord) : null;
}
function updateText(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return typeof record?.text === "string" ? record.text : "";
}
function compact(value: string, maxLength = 500): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

export interface AcpConsoleLogger {
  (update: unknown): void;
  flush(): void;
}

export function createAcpConsoleLogger(
  actorId: number,
  log: ConsoleLog,
  locale: Locale = "zh-CN",
  options: { printThinking: boolean; printLlmIo: boolean } = {
    printThinking: true,
    printLlmIo: false,
  },
): AcpConsoleLogger {
  const textLabel = (key: MessageKey) => text(locale, key);
  // 每个 logger 只服务一个玩家；按文本类别和 messageId 合并增量，工具状态仅用于显示去重。
  let pending: { kind: "message" | "thought"; id: string; text: string } | null = null;
  const toolStates = new Map<string, { label: string; status?: string; error: string }>();
  const emitText = (kind: "message" | "thought", value: string) => {
    if (kind === "thought" ? !options.printThinking : !options.printThinking && !options.printLlmIo)
      return;
    const text = compact(value, Infinity);
    if (text && !/^\*?conversation interrupted\*?$/i.test(text)) {
      log(
        `[acp][${actorId}][${kind}] ${kind === "thought" ? textLabel("runtime.acp.thought") : textLabel("runtime.acp.message")}: ${text}`,
        "muted",
      );
    }
  };
  const flush = () => {
    const previous = pending;
    pending = null;
    if (previous) emitText(previous.kind, previous.text);
  };
  const observer = (update: unknown) => {
    const event = asRecord(update);
    if (!event || typeof event.sessionUpdate !== "string") return;
    const type = event.sessionUpdate;
    if (type === "agent_message_chunk" || type === "agent_thought_chunk") {
      const kind = type === "agent_message_chunk" ? "message" : "thought";
      if (
        kind === "thought" ? !options.printThinking : !options.printThinking && !options.printLlmIo
      ) {
        flush();
        return;
      }
      const messageId = typeof event.messageId === "string" ? event.messageId : "unknown";
      if (pending && (pending.kind !== kind || pending.id !== messageId)) flush();
      if (!pending) pending = { kind, id: messageId, text: "" };
      pending.text += updateText(event.content);
      // ACP 片段是增量文本；按原分段边界合并后输出，保留文字并限制缓冲长度。
      while (pending.text.length) {
        const newline = pending.text.search(/[\r\n]/);
        let end = newline >= 0 && newline <= 500 ? newline : 500;
        if (newline < 0 && pending.text.length <= 500) break;
        const hasNewline = end === newline;
        // 分段边界不能切断 UTF-16 代理对，否则中文或 emoji 会损坏。
        if (!hasNewline && /[\uD800-\uDBFF]/.test(pending.text[end - 1])) end--;
        emitText(kind, pending.text.slice(0, end));
        pending.text = pending.text.slice(end + (hasNewline ? 1 : 0));
      }
      return;
    }
    flush();
    if (!options.printThinking) return;
    if (type === "tool_call") {
      const rawInput = asRecord(event.rawInput);
      const server = typeof rawInput?.server === "string" ? rawInput.server : undefined;
      const tool = typeof rawInput?.tool === "string" ? rawInput.tool : undefined;
      const title = typeof event.title === "string" ? compact(event.title, 180) : "tool";
      const label = server && tool ? `${server}.${tool}` : title;
      const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : undefined;
      if (toolCallId)
        toolStates.set(toolCallId, {
          label,
          status: typeof event.status === "string" ? event.status : undefined,
          error: "",
        });
      log(`[acp][${actorId}][tool] start ${label} · ${textLabel("runtime.acp.start")}`, "muted");
      return;
    }
    if (type === "tool_call_update") {
      const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : undefined;
      const previous = toolCallId ? toolStates.get(toolCallId) : undefined;
      const label =
        typeof event.title === "string" ? compact(event.title, 180) : (previous?.label ?? "tool");
      const status = typeof event.status === "string" ? event.status : undefined;
      const error =
        event.error === undefined || event.error === null || event.error === ""
          ? ""
          : formatErrorDiagnostic(event.error, locale);
      // 部分更新可只补充输入或内容；保留其显示元数据，仅在状态改变或出现新错误时打印。
      const changed =
        (status !== undefined && status !== previous?.status) ||
        (error !== "" && error !== previous?.error);
      if (toolCallId)
        toolStates.set(toolCallId, {
          label,
          status: status ?? previous?.status,
          error: error || previous?.error || "",
        });
      if (!changed) return;
      const displayStatus = status ?? previous?.status ?? "error";
      const statusKey = `runtime.acp.${displayStatus}` as MessageKey;
      const explanation = Object.hasOwn(dictionaries[locale], statusKey)
        ? textLabel(statusKey)
        : displayStatus;
      log(
        `[acp][${actorId}][tool] ${displayStatus} ${label} · ${explanation}${error ? ` error=${error}` : ""}`,
        error || status === "failed" ? "warn" : "muted",
      );
    }
  };
  return Object.assign(observer, {
    flush: () => {
      flush();
      toolStates.clear();
    },
  });
}
