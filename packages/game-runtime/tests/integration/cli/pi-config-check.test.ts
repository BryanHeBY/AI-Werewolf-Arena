/**
 * 配置 CLI 集成测试以临时 V2 Pi 原生 JSON 验证静态 adapter 校验和安全诊断。
 * 独立预期为字面错误码、无会话文件与脱敏白名单概要，不用生产结果计算预期。
 * 仅配置检查，不创建 runtime、会话、认证文件或模型请求；全部密钥为合成值。
 */
import { expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import { checkConfig } from "../../../../../apps/game/src/cli/check-config";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";
const secret = "synthetic-pi-static-config-secret";
async function fixture() {
  const root = await createTestTempDirectory("awa-pi-config-check-");
  for (const dir of ["runtime", "boards", "games"]) await fs.mkdir(path.join(root, dir));
  const backends = {
    schemaVersion: 2,
    items: {
      native: {
        kind: "pi",
        config: { models: { providers: {} }, auth: { openai: { type: "api_key", key: secret } } },
      },
    },
  };
  const agents = {
    schemaVersion: 2,
    default: "native",
    items: {
      native: {
        backend: "native",
        options: {
          defaultProvider: "openai",
          defaultModel: "synthetic-test-model",
          defaultThinkingLevel: "medium",
        },
      },
    },
  };
  const write = async () => {
    await fs.writeFile(path.join(root, "runtime/backends.json"), JSON.stringify(backends));
    await fs.writeFile(path.join(root, "runtime/agents.json"), JSON.stringify(agents));
  };
  await write();
  await fs.writeFile(
    path.join(root, "games/default.json"),
    JSON.stringify({ board: "six_player_mvp" }),
  );
  await fs.copyFile(
    path.resolve(import.meta.dir, "../../../../../configs.example/boards/six_player_mvp.json"),
    path.join(root, "boards/six_player_mvp.json"),
  );
  return { root, backends, agents, write };
}
test("Pi config check performs pure validation and emits only safe profile summary", async () => {
  const { root } = await fixture();
  const before = await fs.readdir(root);
  const report = await checkConfig(root, "default");
  expect(report.defaultAgent).toMatchObject({ name: "native", kind: "pi", providerName: "native" });
  expect(JSON.stringify(report)).not.toContain(secret);
  expect(await fs.readdir(root)).toEqual(before);
  expect((await fs.readdir(path.join(root, "runtime"))).sort()).toEqual([
    "agents.json",
    "backends.json",
  ]);
});
test("Pi invalid native models and invalid execution settings fail config check before sessions exist", async () => {
  const f = await fixture();
  Reflect.set(f.backends.items.native.config, "models", {
    providers: { synthetic: { models: [{ id: "x", unsupportedModelField: secret }] } },
  });
  await f.write();
  await expect(checkConfig(f.root, "default")).rejects.toThrow("pi_models_invalid");
  Reflect.set(f.backends.items.native.config, "models", { providers: {} });
  Reflect.set(f.agents.items.native.options, "packages", [secret]);
  await f.write();
  await expect(checkConfig(f.root, "default")).rejects.toThrow("pi_resources_disabled");
});

test("actual Pi config CLI returns a fixed diagnostic without native configuration values", async () => {
  const f = await fixture();
  Reflect.set(f.backends.items.native.config, "models", {
    providers: { synthetic: { models: [{ id: "x", unsupportedModelField: secret }] } },
  });
  await f.write();
  const child = Bun.spawn(
    [
      Bun.env.BUN_RUNTIME_EXECUTABLE ?? "bun",
      path.resolve(import.meta.dir, "../../../../../apps/game/src/cli/check-config.ts"),
      "--configs-dir",
      f.root,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(code).toBe(1);
  expect(stdout).toBe("");
  expect(JSON.parse(stderr)).toMatchObject({ code: "pi_models_invalid" });
  expect(stderr).not.toContain(secret);
  expect(stderr).not.toContain(" at ");
});
