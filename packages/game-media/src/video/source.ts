/**
 * 负责为单局视频脚本建立稳定的内容指纹。输入为已校验的原复盘或封装归档，输出会话和规范内容摘要。
 * 字段顺序不影响摘要，显示语言与时区不参与输入；指纹只发现误绑文件，不充当安全签名。
 */
import {
  readReplayArchive,
  type ReplayDocument,
  type RecordingEnvelope,
} from "@ai-werewolf-arena/replay-contract";
import type { VideoSourceIdentity } from "./types";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function getVideoSourceIdentity(
  input: ReplayDocument | RecordingEnvelope<ReplayDocument>,
): VideoSourceIdentity {
  const replay = readReplayArchive(input).replay;
  const bytes = new TextEncoder().encode(canonical(replay));
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return {
    sessionId: replay.sessionId,
    fingerprint: `fnv1a64:${hash.toString(16).padStart(16, "0")}`,
  };
}
