import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { assertReplayDocument, ReplayDocumentValidationError } from "@ai-werewolf-arena/replay-contract";

export type ReplayLoadState =
  | { status: "loading" }
  | { status: "ready"; replay: ReplayDocument }
  | { status: "missing" }
  | { status: "error"; message: string };

export function parseOfflineReplayJson(raw: string): ReplayDocument {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("这不是 AI Werewolf Arena 的 replay.json 文件。");
  }
  try {
    assertReplayDocument(value);
  } catch (error) {
    if (error instanceof ReplayDocumentValidationError && error.kind === "missing_fields") {
      throw new Error("复盘文件缺少 meta、result 或 players 字段。");
    }
    throw new Error("这不是 AI Werewolf Arena 的 replay.json 文件。");
  }
  return value;
}

export async function readOfflineReplay(file: File): Promise<ReplayDocument> {
  return parseOfflineReplayJson(await file.text());
}

export async function loadReplay(): Promise<ReplayLoadState> {
  try {
    const response = await fetch("/api/replay");
    if (response.status === 404) return { status: "missing" };
    if (!response.ok) throw new Error(`读取复盘失败（HTTP ${response.status}）`);
    return { status: "ready", replay: parseOfflineReplayJson(await response.text()) };
  } catch (cause) {
    return {
      status: "error",
      message: cause instanceof Error ? cause.message : "无法读取复盘文件。",
    };
  }
}
