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

export interface AcpConsoleLogger {
  (update: unknown): void;
  flush(): void;
}

export function createAcpConsoleLogger(actorId: number, log: ConsoleLog): AcpConsoleLogger {
  let pending: { kind: "message" | "thought"; id: string; text: string } | null = null;
  const toolStates = new Map<string, { label: string; status?: string; error: string }>();
  const emitText = (kind: "message" | "thought", value: string) => {
    const text = compact(value, Infinity);
    if (text && !/^\*?conversation interrupted\*?$/i.test(text)) {
      log(`[acp][${actorId}][${kind}] ${text}`, "muted");
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
      const messageId = typeof event.messageId === "string" ? event.messageId : "unknown";
      if (pending && (pending.kind !== kind || pending.id !== messageId)) flush();
      if (!pending) pending = { kind, id: messageId, text: "" };
      pending.text += updateText(event.content);
      // ACP chunks are deltas, not log lines. Bound the buffer without dropping
      // text, and emit complete lines even while a long prompt is still running.
      while (pending.text.length) {
        const newline = pending.text.search(/[\r\n]/);
        let end = newline >= 0 && newline <= 500 ? newline : 500;
        if (newline < 0 && pending.text.length <= 500) break;
        const hasNewline = end === newline;
        // Do not split a UTF-16 surrogate pair at the segment boundary.
        if (!hasNewline && /[\uD800-\uDBFF]/.test(pending.text[end - 1])) end--;
        emitText(kind, pending.text.slice(0, end));
        pending.text = pending.text.slice(end + (hasNewline ? 1 : 0));
      }
      return;
    }
    flush();
    if (type === "tool_call") {
      const rawInput = asRecord(event.rawInput);
      const server = typeof rawInput?.server === "string" ? rawInput.server : undefined;
      const tool = typeof rawInput?.tool === "string" ? rawInput.tool : undefined;
      const title = typeof event.title === "string" ? compact(event.title, 180) : "tool";
      const label = server && tool ? `${server}.${tool}` : title;
      const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : undefined;
      if (toolCallId) toolStates.set(toolCallId, {
        label, status: typeof event.status === "string" ? event.status : undefined, error: "",
      });
      log(`[acp][${actorId}][tool] start ${label}`, "muted");
      return;
    }
    if (type === "tool_call_update") {
      const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : undefined;
      const previous = toolCallId ? toolStates.get(toolCallId) : undefined;
      const label = typeof event.title === "string" ? compact(event.title, 180) : previous?.label ?? "tool";
      const status = typeof event.status === "string" ? event.status : undefined;
      const error = compact(updateText(event.error), 240);
      // Partial updates can refine input/content without changing tool status.
      // Keep their metadata, but only print lifecycle changes or new errors.
      const changed = (status !== undefined && status !== previous?.status)
        || (error !== "" && error !== previous?.error);
      if (toolCallId) toolStates.set(toolCallId, {
        label, status: status ?? previous?.status, error: error || previous?.error || "",
      });
      if (!changed) return;
      const displayStatus = status ?? previous?.status ?? "error";
      log(`[acp][${actorId}][tool] ${displayStatus} ${label}${error ? ` error=${error}` : ""}`, error || status === "failed" ? "warn" : "muted");
    }
  };
  return Object.assign(observer, { flush: () => {
    flush();
    toolStates.clear();
  } });
}
