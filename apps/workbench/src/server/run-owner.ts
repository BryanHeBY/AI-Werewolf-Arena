/**
 * 负责本机运行所有权的三态核验；输入登记身份和只读平台查询，输出 live、dead 或 unknown。
 * 停止、状态展示和删除共用同一判断；查询不可用保持未知，不以 PID 或过期心跳认定死亡。
 */
import os from "node:os";
import { readBootId, readProcessIdentity } from "@ai-werewolf-arena/game-runtime/run-session";
interface OwnerProbe {
  host: string;
  signal(pid: number): void;
  boot(): Promise<string | null>;
  identity(pid: number): Promise<string | null>;
}
const localProbe: OwnerProbe = {
  host: os.hostname(),
  signal: (pid) => {
    process.kill(pid, 0);
  },
  boot: readBootId,
  identity: readProcessIdentity,
};
export async function inspectRunOwner(
  owner: unknown,
  probe: OwnerProbe = localProbe,
): Promise<"live" | "dead" | "unknown"> {
  if (!owner || typeof owner !== "object") return "unknown";
  const record = owner as Record<string, unknown>;
  if (
    record.host !== probe.host ||
    !Number.isSafeInteger(record.pid) ||
    Number(record.pid) <= 0 ||
    typeof record.bootId !== "string" ||
    !record.bootId ||
    typeof record.processStart !== "string" ||
    !record.processStart
  )
    return "unknown";
  const pid = record.pid as number;
  // 已消失的 PID 不必启动平台查询进程；EPERM 等权限错误仍保留未知。
  try {
    probe.signal(pid);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return "dead";
  }
  const boot = await probe.boot();
  if (!boot) return "unknown";
  if (record.bootId !== boot) return "dead";
  const identity = await probe.identity(pid);
  if (identity) return identity === record.processStart ? "live" : "dead";
  try {
    probe.signal(pid);
    return "unknown";
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH" ? "dead" : "unknown";
  }
}
