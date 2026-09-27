import { getDefaultScriptEventRenderRegistry } from "../game";
import type { GameEvent, RuntimeSnapshot } from "../core";
import { colorize, isAnsiEnabled } from "../utils/ansi";

export type ConsoleTone = "muted" | "info" | "ok" | "warn" | "error" | "accent" | "god";
export type ConsoleLog = (text: string, tone?: ConsoleTone) => void;

export function toChatLines(events: readonly GameEvent[]): string[] {
  const registry = getDefaultScriptEventRenderRegistry();
  return events.flatMap((event) => {
    const line = registry.toChatLine(event);
    return line ? [line] : [];
  });
}

export function createConsoleLog(color: boolean): ConsoleLog {
  const enabled = isAnsiEnabled(color);
  return (text, tone = "info") => console.log(colorize(text, tone, enabled));
}

export function presentStreamEvents(
  events: readonly GameEvent[],
  printPrivateEvents: boolean,
  log: ConsoleLog,
): void {
  const registry = getDefaultScriptEventRenderRegistry();
  for (const event of events) {
    for (const render of registry.toLiveRender(event, printPrivateEvents)) {
      const tone = render.kind === "chat" ? "accent" : render.kind === "private" ? "warn"
        : render.kind === "action" ? "info" : render.kind === "god" ? "god" : "ok";
      log(render.text, tone);
    }
  }
}

export function presentGameResult(input: {
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
    `[run_game] done board=${board} gameOver=${snapshot.gameOver} day=${snapshot.day} winner=${snapshot.result?.winner ?? "none"} timedOut=${timedOut}`,
    "ok",
  );
  log(`[run_game] events=${events.length}`, "info");
  if (input.printAllEvents) console.log(JSON.stringify(events, null, 2));
  if (input.printChat && !input.streamEvents) {
    for (const line of toChatLines(events)) console.log(line);
  }
}

type AcpUpdateRecord = Record<string, unknown>;
function asRecord(value: unknown): AcpUpdateRecord | null {
  return value && typeof value === "object" ? value as AcpUpdateRecord : null;
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

export function createAcpConsoleLogger(actorId: number, log: ConsoleLog): (update: unknown) => void {
  let pendingMessage: { id: string; text: string } | null = null;
  const toolLabels = new Map<string, string>();
  const flushMessage = () => {
    if (!pendingMessage) return;
    const text = compact(pendingMessage.text);
    if (text && !/^\*?conversation interrupted\*?$/i.test(text)) log(`[acp][${actorId}][message] ${text}`, "muted");
    pendingMessage = null;
  };
  return (update: unknown) => {
    const event = asRecord(update);
    if (!event || typeof event.sessionUpdate !== "string") return;
    const type = event.sessionUpdate;
    if (type === "agent_message_chunk") {
      const messageId = typeof event.messageId === "string" ? event.messageId : "unknown";
      if (pendingMessage && pendingMessage.id !== messageId) flushMessage();
      if (!pendingMessage) pendingMessage = { id: messageId, text: "" };
      pendingMessage.text += updateText(event.content);
      return;
    }
    flushMessage();
    if (type === "agent_thought_chunk") {
      const text = compact(updateText(event.content), 240);
      if (text) log(`[acp][${actorId}][thought] ${text}`, "muted");
      return;
    }
    if (type === "tool_call") {
      const rawInput = asRecord(event.rawInput);
      const server = typeof rawInput?.server === "string" ? rawInput.server : undefined;
      const tool = typeof rawInput?.tool === "string" ? rawInput.tool : undefined;
      const title = typeof event.title === "string" ? compact(event.title, 180) : "tool";
      const label = server && tool ? `${server}.${tool}` : title;
      const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : undefined;
      if (toolCallId) toolLabels.set(toolCallId, label);
      log(`[acp][${actorId}][tool] start ${label}`, "muted");
      return;
    }
    if (type === "tool_call_update") {
      const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : undefined;
      const label = toolCallId ? toolLabels.get(toolCallId) ?? "tool" : "tool";
      const status = typeof event.status === "string" ? event.status : "updated";
      const error = compact(updateText(event.error), 240);
      log(`[acp][${actorId}][tool] ${status} ${label}${error ? ` error=${error}` : ""}`, error || status === "failed" ? "warn" : "muted");
      if (toolCallId && (status === "completed" || status === "failed")) toolLabels.delete(toolCallId);
    }
  };
}
