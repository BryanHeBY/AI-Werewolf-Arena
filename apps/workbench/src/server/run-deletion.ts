/**
 * 负责对局删除前的文件版本与存活性核验；输入单局的显式路径，输出只包含摘要和阻止原因的凭据。
 * 心跳过期不代表进程死亡；同机启动身份可证实存活／已消失，外机和不可读身份一律保守拒绝。
 * 不递归清理任何父目录，不管理 output，也不通过 PID 杀进程。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { inspectRunOwner } from "./run-owner";
import { containedFile, revision, WorkbenchError } from "./config-documents";

async function optional(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
function json(raw: string | null): any {
  try {
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}
export interface RunDeletionSnapshot {
  revision: string;
  canDelete: boolean;
  deleteBlock?: string;
  directory: string;
  files: string[];
}
export async function runDeletionSnapshot(
  records: string,
  jobs: string,
  id: string,
): Promise<RunDeletionSnapshot> {
  if (!/^session_[a-zA-Z0-9_-]+$/.test(id)) throw new WorkbenchError("invalid_session");
  const directory = await containedFile(records, id);
  const manifestFile = await containedFile(records, `${id}/manifest.json`);
  const runtimeFile = await containedFile(records, `${id}/runtime.json`);
  const completionFile = await containedFile(records, `${id}/completion.json`);
  const jobFile = await containedFile(jobs, `${id}.json`);
  const startupFile = await containedFile(jobs, `${id}.startup.log`);
  const raws = await Promise.all(
    [manifestFile, runtimeFile, completionFile, jobFile].map(optional),
  );
  const [manifest, runtime, , job] = raws.map(json);
  if ((!manifest || manifest.session_id !== id) && (!job || job.sessionId !== id))
    throw new WorkbenchError("run_not_found", 404);
  const stamps: unknown[] = [];
  for (const file of [directory, startupFile]) {
    try {
      const stat = await fs.lstat(file);
      stamps.push([stat.ino, stat.size, stat.mtimeMs]);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      stamps.push(null);
    }
  }
  let deleteBlock: string | undefined;
  if (
    (raws[1] !== null && !runtime) ||
    (raws[3] !== null &&
      (!job ||
        job.sessionId !== id ||
        ![
          "starting",
          "running",
          "finalizing",
          "completed",
          "failed",
          "cancelled",
          "lost",
          "interrupted",
          "legacy",
        ].includes(job.state)))
  )
    deleteBlock = "run_liveness_unknown";
  for (const owner of [runtime, job?.launcher]) {
    if (!owner) continue;
    const state = await inspectRunOwner(owner);
    if (state === "live") {
      deleteBlock = "run_still_alive";
      break;
    }
    if (state === "unknown") deleteBlock = "run_liveness_unknown";
  }
  if (
    !runtime &&
    !job?.launcher &&
    (manifest?.finish_reason === "in_progress" ||
      ["starting", "running", "finalizing", "lost"].includes(job?.state))
  )
    deleteBlock = "run_liveness_unknown";
  return {
    revision: revision(JSON.stringify([raws, stamps])),
    canDelete: !deleteBlock,
    ...(deleteBlock ? { deleteBlock } : {}),
    directory,
    files: [jobFile, startupFile],
  };
}
/** 清理前拒绝目录树内的链接；单局之外的内容不进入递归删除。 */
export async function assertPlainDirectory(directory: string): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new WorkbenchError("symlink_not_allowed");
    if (entry.isDirectory()) await assertPlainDirectory(path.join(directory, entry.name));
  }
}
