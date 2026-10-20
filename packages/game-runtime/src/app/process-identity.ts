/**
 * 负责跨平台进程启动身份与系统启动身份；输入经过校验的 PID 和当前系统，输出稳定、不含认证的标识，查询失败返回 null。
 * Linux 使用 /proc，Windows 使用固定 PowerShell 查询，macOS 使用系统只读工具。
 * Windows PID 只通过经整数校验的环境变量传递；不拼接 shell 命令，不用单独 PID 授予控制权。
 */
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
const windowsProcessScript =
  '$ErrorActionPreference="Stop"; $p=Get-Process -Id ([int]$env:AWA_IDENTITY_PID) -ErrorAction Stop; $p.StartTime.ToUniversalTime().Ticks.ToString()';
const windowsBootScript =
  '$ErrorActionPreference="Stop"; (Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).LastBootUpTime.ToUniversalTime().Ticks.ToString()';

export function windowsIdentityCommand(pid?: number) {
  if (pid !== undefined && (!Number.isSafeInteger(pid) || pid <= 0))
    throw new Error("invalid_process_id");
  return {
    file: "powershell.exe",
    args: [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      pid === undefined ? windowsBootScript : windowsProcessScript,
    ],
    ...(pid === undefined ? {} : { environment: { AWA_IDENTITY_PID: String(pid) } }),
  };
}
export function windowsIdentity(output: string, kind: "process" | "boot"): string | null {
  const value = output.replace(/^\uFEFF/, "").trim();
  return /^\d{15,20}$/.test(value) ? `windows:${kind}:${value}` : null;
}
async function windowsProbe(pid?: number): Promise<string | null> {
  const command = windowsIdentityCommand(pid);
  const { stdout } = await execute(command.file, command.args, {
    windowsHide: true,
    timeout: 5000,
    maxBuffer: 16384,
    env: { ...process.env, ...command.environment },
  });
  return windowsIdentity(stdout, pid === undefined ? "boot" : "process");
}
export async function readProcessIdentity(pid: number): Promise<string | null> {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    if (process.platform === "win32") return await windowsProbe(pid);
    if (process.platform === "linux") {
      const stat = await fs.readFile(`/proc/${pid}/stat`, "utf8");
      return stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19] ?? null;
    }
    if (process.platform === "darwin") {
      const { stdout } = await execute("ps", ["-p", String(pid), "-o", "lstart="], {
        env: { ...process.env, LC_ALL: "C" },
        timeout: 3000,
      });
      return stdout.trim() ? `darwin:process:${stdout.trim()}` : null;
    }
  } catch {
    /* 身份无法读取时不降级成 PID 授权。 */
  }
  return null;
}
let bootIdentity: Promise<string | null> | undefined;
export function readBootId(): Promise<string | null> {
  // 本进程不可能跨越系统重启，启动身份可以在服务内复用；失败不缓存，允许环境恢复。
  if (!bootIdentity)
    bootIdentity = queryBootId().then((value) => {
      if (value === null) bootIdentity = undefined;
      return value;
    });
  return bootIdentity;
}
async function queryBootId(): Promise<string | null> {
  try {
    if (process.platform === "win32") return await windowsProbe();
    if (process.platform === "linux")
      return (await fs.readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim() || null;
    if (process.platform === "darwin") {
      const { stdout } = await execute("sysctl", ["-n", "kern.boottime"], { timeout: 3000 });
      const seconds = /sec\s*=\s*(\d+)/.exec(stdout)?.[1];
      return seconds ? `darwin:boot:${seconds}` : null;
    }
  } catch {
    /* 保留未知状态，调用方不得据此认定进程已死亡。 */
  }
  return null;
}
