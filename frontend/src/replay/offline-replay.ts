import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseOfflineReplayJson(raw: string): ReplayDocument {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || typeof value.sessionId !== "string" || !Array.isArray(value.events)) {
    throw new Error("这不是 AI Werewolf Arena 导出的 .replay.json 文件。");
  }
  if (!isRecord(value.meta) || !isRecord(value.result) || !Array.isArray(value.phaseWindows)) {
    throw new Error("复盘文件缺少 meta、result 或 phaseWindows 字段。");
  }
  return value as unknown as ReplayDocument;
}

export async function readOfflineReplay(file: File): Promise<ReplayDocument> {
  return parseOfflineReplayJson(await file.text());
}

export function eventLabel(event: ReplayEvent): string {
  if (event.render_text) return event.render_text;
  const payload = event.payload;
  if (typeof payload.text === "string") return payload.text;
  if (event.type === "night_resolved") return "夜晚结算";
  if (event.type === "phase_changed") return `进入 ${String(payload.phase ?? event.phase)}`;
  return event.type;
}
