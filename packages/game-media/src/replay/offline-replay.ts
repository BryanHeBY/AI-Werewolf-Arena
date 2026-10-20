/**
 * 负责离线文件与本地 API 的复盘读取；输入为用户原文件或响应，输出为原规范 ReplayDocument 与结构化错误。
 * 显式新封装必须由真实展示 owner 支持；历史未声明／v1／v2继续原转换，不补造版本或改写用户原文。
 * 本模块不执行游戏、验证真实源码或授予严格复现兼容；视频入口也消费同一 reader。
 */
import { supportsGamePresentation } from "@ai-werewolf-arena/game-presentation";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import {
  readReplayArchive,
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
    const archive = readReplayArchive(value);
    // 只检查当前 renderer 实际拥有的格式；没有声明的旧档不被伪装成当前发布版本。
    if (archive.identities && !supportsGamePresentation(archive.identities.presentation))
      throw new ReplayDocumentValidationError("unsupported_version", "identities.presentation");
    return archive.replay;
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
export async function loadReplay(signal?: AbortSignal): Promise<ReplayLoadState> {
  try {
    const response = await fetch("/api/replay", { signal });
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
