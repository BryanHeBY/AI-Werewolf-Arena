/**
 * 负责复盘文件／会话目录的输入定位。输入基准由调用入口显式传入，输出已存在的绝对复盘文件路径，只验证目标文件存在。
 * 不解析录制内容，不搜索其它数据根，也不写回原始归档。
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
export function resolveReplayInput(input: string, cwd: string = process.cwd()): string {
  const resolved = path.resolve(cwd, input);
  if (!existsSync(resolved)) {
    throw new Error(`Replay input not found: ${resolved}`);
  }
  const replayPath = statSync(resolved).isDirectory()
    ? path.join(resolved, "replay.json")
    : resolved;
  if (!existsSync(replayPath) || !statSync(replayPath).isFile()) {
    throw new Error(`Replay file not found: ${replayPath}`);
  }
  return replayPath;
}
