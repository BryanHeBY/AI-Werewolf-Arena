/**
 * 测试负责跨平台身份命令与解析边界；输入字面 PowerShell 输出、PID 和当前测试进程，输出为手写独立预期。
 * 固定脚本断言确保 PID 只作为数据传递；不启动游戏、不读取认证，平台查询失败保持未知。
 */
import { test, expect } from "bun:test";
import {
  windowsIdentity,
  windowsIdentityCommand,
  readProcessIdentity,
  readBootId,
} from "../../../src/app/process-identity";

test("Windows command is fixed and PID travels only as validated environment data", () => {
  const first = windowsIdentityCommand(12),
    second = windowsIdentityCommand(12345);
  expect(first.file).toBe("powershell.exe");
  expect(first.args).toEqual(second.args);
  expect(first.args).toContain("-NonInteractive");
  expect(first.args.at(-1)).toContain("$env:AWA_IDENTITY_PID");
  expect(first.environment).toEqual({ AWA_IDENTITY_PID: "12" });
  expect(second.environment).toEqual({ AWA_IDENTITY_PID: "12345" });
  expect(windowsIdentityCommand().args.at(-1)).toContain("Win32_OperatingSystem");
  for (const invalid of [0, -1, NaN, Infinity, 1.2])
    expect(() => windowsIdentityCommand(invalid)).toThrow("invalid_process_id");
});
test("Windows timestamps have stable namespaces and malformed output cannot become an identity", () => {
  expect(windowsIdentity("\uFEFF638965440000000000\r\n", "process")).toBe(
    "windows:process:638965440000000000",
  );
  expect(windowsIdentity("638965440000000000", "boot")).toBe("windows:boot:638965440000000000");
  for (const value of [
    "",
    "0",
    "638965440000000000\nother",
    "access denied",
    "NaN",
    "{ticks:638965440000000000}",
  ])
    expect(windowsIdentity(value, "process")).toBeNull();
});
test("current supported platform returns repeatable startup and boot identities", async () => {
  for (const invalid of [0, -1, NaN, 1.1]) expect(await readProcessIdentity(invalid)).toBeNull();
  if (!["linux", "win32", "darwin"].includes(process.platform)) return;
  const first = await readProcessIdentity(process.pid);
  expect(typeof first).toBe("string");
  expect(first).toBeTruthy();
  expect(await readProcessIdentity(process.pid)).toBe(first);
  const boot = await readBootId();
  expect(typeof boot).toBe("string");
  expect(boot).toBeTruthy();
  expect(await readBootId()).toBe(boot);
  // Windows 的首次 PowerShell/CIM 冷启动及后续独立查询各有有限预算；不重试或跳过真实身份断言。
}, 60000);
