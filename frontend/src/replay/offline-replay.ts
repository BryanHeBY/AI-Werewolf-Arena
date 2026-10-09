import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import {
  readReplayDocument,
  ReplayDocumentValidationError,
} from "@ai-werewolf-arena/replay-contract";
import { renderMessage, type Locale, type MessageRef } from "@ai-werewolf-arena/game-text";

export class ReplayLoadError extends Error {
  constructor(
    readonly messageRef: MessageRef,
    locale: Locale = "zh-CN",
  ) {
    super(renderMessage(locale, messageRef));
    this.name = "ReplayLoadError";
  }
}
export type ReplayLoadState =
  | { status: "loading" }
  | { status: "ready"; replay: ReplayDocument }
  | { status: "missing" }
  | { status: "error"; message: MessageRef };

export function parseOfflineReplayJson(raw: string): ReplayDocument {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ReplayLoadError({ key: "replay.invalid_file" });
  }
  try {
    return readReplayDocument(value);
  } catch (error) {
    const key =
      error instanceof ReplayDocumentValidationError && error.kind === "missing_fields"
        ? "replay.missing_fields"
        : error instanceof ReplayDocumentValidationError && error.kind === "unsupported_version"
          ? "replay.unsupported_version"
          : "replay.invalid_file";
    throw new ReplayLoadError({ key });
  }
}
export async function readOfflineReplay(file: File): Promise<ReplayDocument> {
  try {
    return parseOfflineReplayJson(await file.text());
  } catch (error) {
    throw error instanceof ReplayLoadError
      ? error
      : new ReplayLoadError({ key: "replay.read_failed" });
  }
}
export async function loadReplay(): Promise<ReplayLoadState> {
  try {
    const response = await fetch("/api/replay");
    if (response.status === 404) return { status: "missing" };
    if (!response.ok)
      throw new ReplayLoadError({
        key: "replay.http_failed",
        parameters: { status: response.status },
      });
    return { status: "ready", replay: parseOfflineReplayJson(await response.text()) };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof ReplayLoadError ? error.messageRef : { key: "replay.read_failed" },
    };
  }
}
