/**
 * 负责终端游戏事件、结果与 ACP 增量输出。输入为已投影事件、运行摘要、ACP 更新与输出选项；输出为原文本和着色日志。
 * 副作用为同步调用原 log／console；每个 ACP logger 只保存本玩家的文本片段与工具显示状态，不落盘或提交游戏行动。
 * 本模块不计算请求期限或发起取消；会话关闭与超时由运行调用方处理，flush 仅输出本地尾段并清空工具显示缓存。
 * 分段、去重与输出调用保原顺序；渲染、字段读取或日志抛错仍向调用方传播，不在此回滚已输出内容。
 */
import { createAcpOutputObserver } from "../acp/acp-output";
import { createAgentConsoleSink } from "./agent-console-presenter";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
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

/** 原 ACP 公开入口仅负责接线；协议转换与终端展示分别有唯一所有者。 */
export interface AcpConsoleLogger {
  (update: unknown): void;
  flush(): void;
}
export function createAcpConsoleLogger(
  actorId: number,
  log: ConsoleLog,
  locale: Locale = "zh-CN",
  options: { printThinking: boolean; printLlmIo: boolean; trace?: boolean } = {
    printThinking: true,
    printLlmIo: false,
  },
): AcpConsoleLogger {
  const observer = createAcpOutputObserver(
    { transport: "acp", playerId: actorId },
    createAgentConsoleSink({ ...options, trace: options.trace ?? false, locale, log }),
  );
  return Object.assign((update: unknown) => observer.update(update), {
    flush: () => observer.flush(),
  });
}
