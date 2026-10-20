/**
 * 测试负责状态、停止和删除共用的运行身份边界；输入字面身份及手写平台查询，输出独立三态预期。
 * 模拟 PowerShell/权限查询不可用，不启动进程、不读取宿主认证，也不以 PID 作为授权替代。
 */
import { test, expect } from "bun:test";
import { inspectRunOwner } from "../../src/server/run-owner";
const owner = { host: "local", pid: 42, bootId: "boot", processStart: "start" };
const probe = {
  host: "local",
  signal: (_pid: number) => {},
  boot: async () => "boot",
  identity: async (_pid: number) => "start",
};
test("unavailable boot or process queries remain unknown while exact identity authorizes live", async () => {
  expect(await inspectRunOwner(owner, probe)).toBe("live");
  expect(await inspectRunOwner(owner, { ...probe, boot: async () => null })).toBe("unknown");
  expect(await inspectRunOwner(owner, { ...probe, identity: async () => null })).toBe("unknown");
  expect(
    await inspectRunOwner(owner, {
      ...probe,
      signal: () => {
        throw Object.assign(new Error("denied"), { code: "EPERM" });
      },
      identity: async () => null,
    }),
  ).toBe("unknown");
  expect(await inspectRunOwner({ ...owner, host: "foreign" }, probe)).toBe("unknown");
});
test("only absent processes or mismatched stable boot/start identities prove death", async () => {
  expect(
    await inspectRunOwner(owner, {
      ...probe,
      signal: () => {
        throw Object.assign(new Error("absent"), { code: "ESRCH" });
      },
    }),
  ).toBe("dead");
  expect(await inspectRunOwner(owner, { ...probe, boot: async () => "new-boot" })).toBe("dead");
  expect(await inspectRunOwner(owner, { ...probe, identity: async () => "new-start" })).toBe(
    "dead",
  );
  for (const invalid of [
    null,
    {},
    { ...owner, pid: 0 },
    { ...owner, pid: 1.5 },
    { ...owner, bootId: "" },
    { ...owner, processStart: "" },
  ])
    expect(await inspectRunOwner(invalid, probe)).toBe("unknown");
});
