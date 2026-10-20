/** 测试负责核对服务文件与身份边界；输入独立临时文件或字面数据，输出由手写独立预期断言。
 * 不读取用户配置与认证，不触碰真实录制或 output；字节预算用于验证分页成本。 */
import { test, expect } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { readCodexSubscription } from "../../src/server/codex-auth";
test("missing, invalid and unsupported credentials remain distinguishable and retryable", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-codex-import-"));
  const file = path.join(root, "auth.json");
  try {
    await expect(readCodexSubscription(file)).rejects.toMatchObject({ code: "codex_auth_missing" });
    await fs.writeFile(file, "{");
    await expect(readCodexSubscription(file)).rejects.toMatchObject({ code: "codex_auth_invalid" });
    await fs.writeFile(file, '{"tokens":{"access_token":""}}');
    await expect(readCodexSubscription(file)).rejects.toMatchObject({
      code: "codex_auth_unavailable",
    });
    const payload = Buffer.from(JSON.stringify({ exp: 2000000000 })).toString("base64url");
    await fs.writeFile(
      file,
      JSON.stringify({
        tokens: {
          access_token: `x.${payload}.x`,
          refresh_token: "synthetic-refresh",
          account_id: "synthetic-account",
        },
      }),
    );
    expect(await readCodexSubscription(file)).toEqual({
      type: "oauth",
      access: `x.${payload}.x`,
      refresh: "synthetic-refresh",
      accountId: "synthetic-account",
      expires: 2000000000000,
    });
    await expect(readCodexSubscription(root)).rejects.toMatchObject({
      code: "codex_auth_unreadable",
    });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
