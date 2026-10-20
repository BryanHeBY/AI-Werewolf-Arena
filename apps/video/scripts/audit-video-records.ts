/**
 * 负责将本地公开复盘目录送入正式视频审计。输入为文件或目录，输出逐文件快照摘要、覆盖诊断和独立错误。
 * 不跟随符号链接、不进入接入配置和嵌套源码；每份归档只读取一次字节，不修改正在写入的record。
 */
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir } from "node:fs/promises";
import path from "node:path";
import { parseOfflineReplayJson } from "@ai-werewolf-arena/game-media/replay/offline-replay";
import { auditVideoReplay } from "@ai-werewolf-arena/game-media/video/plan/audit";
import { READABILITY_ISSUES } from "@ai-werewolf-arena/game-media/video/plan/readability-audit";

const excluded = new Set([
  "node_modules",
  ".git",
  ".codex",
  ".agents",
  ".aws",
  ".ssh",
  ".acp-logs",
  "players",
  "snapshot",
  "snapshots",
  "reproduction",
  "private",
]);
const publicReplay = (name: string) => name === "replay.json" || name.endsWith(".replay.json");
type AuditResult = ReturnType<typeof auditVideoReplay>;
export type VideoAuditFile =
  | { path: string; status: "ok"; sha256: string; bytes: number; audit: AuditResult }
  | { path: string; status: "error"; code: string };
export interface RecordAuditOptions {
  themeId?: "gothic-v1" | "minimal-v1";
  maxFiles?: number;
  maxBytes?: number;
}

/** 文件内容只取同一打开描述符；并发写入导致元数据变化时明确报unstable，不拼接多次快照。 */
async function capture(file: string, limit: number) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    const leaf = await lstat(file);
    if (leaf.isSymbolicLink() || leaf.ino !== before.ino || leaf.dev !== before.dev)
      throw new Error("video_audit_snapshot_changed");
    if (!before.isFile() || before.size > limit) throw new Error("video_audit_file_too_large");
    const buffer = Buffer.alloc(Math.min(before.size + 1, limit + 1));
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    const bytes = buffer.subarray(0, length);
    const after = await handle.stat();
    const current = await lstat(file);
    if (bytes.length > limit) throw new Error("video_audit_file_too_large");
    if (
      before.size !== bytes.length ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs ||
      current.isSymbolicLink() ||
      current.ino !== before.ino ||
      current.dev !== before.dev
    )
      throw new Error("video_audit_snapshot_changed");
    return bytes;
  } finally {
    await handle.close();
  }
}

export async function auditVideoRecords(input: string, options: RecordAuditOptions = {}) {
  const root = path.resolve(input);
  const maxFiles = options.maxFiles ?? 500;
  const maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maxFiles) ||
    maxFiles < 1 ||
    maxFiles > 10000 ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1
  )
    throw new Error("video_audit_limits_invalid");
  const files: string[] = [];
  const discoveryErrors: VideoAuditFile[] = [];
  let truncated = false;
  async function visit(entry: string, top = false): Promise<void> {
    const stat = await lstat(entry);
    if (stat.isSymbolicLink()) {
      if (top) throw new Error("video_audit_symlink_input");
      return;
    }
    if (stat.isFile()) {
      if (publicReplay(path.basename(entry))) {
        if (files.length >= maxFiles) truncated = true;
        else files.push(entry);
      } else if (top) throw new Error("video_audit_public_replay_required");
      return;
    }
    if (!stat.isDirectory() || excluded.has(path.basename(entry))) return;
    const children = (await readdir(entry, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name, "en"),
    );
    // record中可能含旧源码工作区，避免把其测试fixture误算为真实对局。
    if (children.some((child) => child.name === "package.json" || child.name === ".git")) return;
    for (const child of children) {
      if (child.isSymbolicLink() || excluded.has(child.name)) continue;
      const target = path.join(entry, child.name);
      try {
        await visit(target);
      } catch {
        discoveryErrors.push({
          path: path.relative(root, target),
          status: "error",
          code: "video_audit_discovery_failed",
        });
      }
    }
  }
  await visit(root, true);
  if (!files.length && !discoveryErrors.length) throw new Error("video_audit_no_public_replays");
  const results: VideoAuditFile[] = [...discoveryErrors];
  for (const file of files) {
    const relative = path.relative(root, file) || path.basename(file);
    try {
      const bytes = await capture(file, maxBytes);
      const replay = parseOfflineReplayJson(bytes.toString("utf8"));
      const audit = auditVideoReplay(replay, options.themeId);
      results.push({
        path: relative,
        status: "ok",
        sha256: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.length,
        audit,
      });
    } catch (error) {
      // 不透传可能带正文、私有载荷或绝对路径的异常message。
      const code =
        error instanceof Error && /^video_[a-z_]+$/.test(error.message)
          ? error.message
          : "video_audit_archive_or_compile_failed";
      results.push({ path: relative, status: "error", code });
    }
  }
  const good = results.filter((row) => row.status === "ok");
  return {
    schema: "awa-video-scene-audit-v1" as const,
    themeId: options.themeId ?? "gothic-v1",
    truncated,
    summary: {
      files: results.length,
      succeeded: good.length,
      failed: results.length - good.length,
      completed: good.filter((row) => row.audit.completed).length,
      ongoing: good.filter((row) => !row.audit.completed).length,
      counts: Object.fromEntries(
        ["dedicated", "compact_notice", "generic_record", "unhandled"].map((key) => [
          key,
          good.reduce((sum, row) => sum + row.audit.counts[key as keyof AuditResult["counts"]], 0),
        ]),
      ),
      readabilityCounts: Object.fromEntries(
        READABILITY_ISSUES.map((issue) => [
          issue,
          good.reduce((sum, row) => sum + row.audit.readabilityCounts[issue], 0),
        ]),
      ),
    },
    files: results,
  };
}
