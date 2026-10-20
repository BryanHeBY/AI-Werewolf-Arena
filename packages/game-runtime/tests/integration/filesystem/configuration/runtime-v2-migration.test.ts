/**
 * 文件系统集成测试负责显式 runtime 迁移的预览、认证原文备份、V2 装配与失败恢复。
 * 独立预期是手写旧源字节、固定 V2 字段与故障回滚列表，不能用迁移输出反推正确结果。
 * 输入全部为临时目录内合成值；不加载私人配置、宿主认证或付费 SDK，不修改冻结归档。
 */
import { expect, test, spyOn } from "bun:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import { migrateRuntimeConfigs } from "../../../../../../apps/game/src/cli/migrate-configs";
import { loadRuntimeConfig } from "../../../../src/app/config/load-config";
import { resolveAgentProfileByName } from "../../../../src/app/config/resolve-game-setup";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

const secret = "synthetic-runtime-migration-private-value";
async function setup() {
  const root = await createTestTempDirectory("awa-v2-migration-");
  await fs.mkdir(path.join(root, "runtime"));
  await fs.mkdir(path.join(root, "games"));
  const providers = JSON.stringify({
    default: "sdk",
    items: {
      sdk: { type: "openai", apiKey: "${MIGRATION_NOT_IN_ENV}", maxConcurrentRequests: 4 },
      process: {
        type: "acp",
        command: "synthetic-not-executed",
        env: { SECRET: secret },
        sessionConfigOptions: { "fast-mode": true, mode: "default" },
      },
    },
  });
  const agents = JSON.stringify({
    default: "sdk",
    items: {
      sdk: { kind: "llm", provider: "sdk", model: "synthetic" },
      process: {
        kind: "acp",
        provider: "process",
        personalityPrompt: secret,
        sessionConfigOptions: { mode: "override" },
      },
      other: { kind: "acp", provider: "process" },
    },
  });
  await fs.writeFile(path.join(root, "runtime/providers.json"), providers);
  await fs.writeFile(path.join(root, "runtime/agents.json"), agents);
  await fs.writeFile(
    path.join(root, "games/test.json"),
    JSON.stringify({ board: "six_player_mvp", agent: "sdk" }),
  );
  return { root, providers, agents };
}

test("preview is read only and redacted; apply preserves source bytes in backups and migrates ACP options priority", async () => {
  const { root, providers, agents } = await setup();
  const logs: string[] = [];
  const log = spyOn(console, "log").mockImplementation((value) => {
    logs.push(String(value));
  });
  try {
    await migrateRuntimeConfigs(root, false);
    expect((await fs.readdir(path.join(root, "runtime"))).sort()).toEqual([
      "agents.json",
      "providers.json",
    ]);
    expect(logs.join("")).not.toContain(secret);
    expect(logs.join("")).not.toContain("MIGRATION_NOT_IN_ENV");
    await migrateRuntimeConfigs(root, true);
    expect(await fs.readFile(path.join(root, "runtime/providers.json.v1.bak"), "utf8")).toBe(
      providers,
    );
    expect(await fs.readFile(path.join(root, "runtime/agents.json.v1.bak"), "utf8")).toBe(agents);
    await expect(fs.access(path.join(root, "runtime/providers.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const raw = await fs.readFile(path.join(root, "runtime/backends.json"), "utf8");
    expect(raw).toContain("${MIGRATION_NOT_IN_ENV}");
    const runtime = await loadRuntimeConfig({
      configDir: root,
      gameName: "test",
      environment: { MIGRATION_NOT_IN_ENV: secret },
    });
    expect(resolveAgentProfileByName(runtime, "process").provider).toMatchObject({
      sessionConfigOptions: { "fast-mode": true, mode: "override" },
    });
    expect(resolveAgentProfileByName(runtime, "other").provider).toMatchObject({
      sessionConfigOptions: { "fast-mode": true, mode: "default" },
    });
    expect(runtime.providers.items.sdk).toMatchObject({ maxConcurrentRequests: 4 });
    await expect(migrateRuntimeConfigs(root, true)).rejects.toThrow(
      "runtime_config_migration_target_exists",
    );
  } finally {
    log.mockRestore();
  }
});

test("normal loading never probes legacy providers and old agents require migration", async () => {
  const { root } = await setup();
  await expect(
    loadRuntimeConfig({ configDir: root, gameName: "test", environment: {} }),
  ).rejects.toThrow("runtime_config_file_missing: backends");
  await fs.writeFile(
    path.join(root, "runtime/backends.json"),
    JSON.stringify({
      schemaVersion: 2,
      items: { sdk: { kind: "llm", config: { type: "openai", apiKey: secret } } },
    }),
  );
  await expect(
    loadRuntimeConfig({ configDir: root, gameName: "test", environment: {} }),
  ).rejects.toThrow("runtime_config_schema_version_invalid: agents.schemaVersion");
});

test("all game references and backup conflicts fail before publishing any V2 file", async () => {
  const { root, providers, agents } = await setup();
  await fs.writeFile(path.join(root, "games/z-invalid.json"), JSON.stringify({ agent: "missing" }));
  await expect(migrateRuntimeConfigs(root, true)).rejects.toThrow("runtime_config_agent_not_found");
  expect((await fs.readdir(path.join(root, "runtime"))).sort()).toEqual([
    "agents.json",
    "providers.json",
  ]);
  await fs.unlink(path.join(root, "games/z-invalid.json"));
  await fs.writeFile(path.join(root, "runtime/agents.json.v1.bak"), "other-source");
  await expect(migrateRuntimeConfigs(root, true)).rejects.toThrow(
    "runtime_config_migration_backup_conflict",
  );
  await expect(fs.access(path.join(root, "runtime/backends.json"))).rejects.toMatchObject({
    code: "ENOENT",
  });
  expect(await fs.readFile(path.join(root, "runtime/providers.json"), "utf8")).toBe(providers);
  expect(await fs.readFile(path.join(root, "runtime/agents.json"), "utf8")).toBe(agents);
});

test("a failed second publication restores both old files without retiring providers", async () => {
  const { root, providers, agents } = await setup();
  const failure = new Error("synthetic-publish-failure");
  const original = fs.rename;
  let calls = 0;
  const rename = spyOn(fs, "rename").mockImplementation(async (from, to) => {
    if (++calls === 1) throw failure;
    await original(from, to);
  });
  try {
    await expect(migrateRuntimeConfigs(root, true)).rejects.toBe(failure);
    expect(await fs.readFile(path.join(root, "runtime/providers.json"), "utf8")).toBe(providers);
    expect(await fs.readFile(path.join(root, "runtime/agents.json"), "utf8")).toBe(agents);
    await expect(fs.access(path.join(root, "runtime/backends.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  } finally {
    rename.mockRestore();
  }
});

test("published backends are rolled back when temporary cleanup fails after link; competing targets stay untouched", async () => {
  const { root, providers, agents } = await setup(),
    failure = new Error("synthetic-temporary-cleanup-failure");
  const original = fs.unlink;
  let triggered = false;
  const unlink = spyOn(fs, "unlink").mockImplementation(async (file) => {
    if (!triggered && String(file).includes("backends.json.") && String(file).endsWith(".tmp")) {
      triggered = true;
      throw failure;
    }
    await original(file);
  });
  try {
    await expect(migrateRuntimeConfigs(root, true)).rejects.toBe(failure);
    expect(triggered).toBe(true);
    expect(await fs.readFile(path.join(root, "runtime/providers.json"), "utf8")).toBe(providers);
    expect(await fs.readFile(path.join(root, "runtime/agents.json"), "utf8")).toBe(agents);
    expect((await fs.readdir(path.join(root, "runtime"))).sort()).toEqual([
      "agents.json",
      "agents.json.v1.bak",
      "providers.json",
      "providers.json.v1.bak",
    ]);
  } finally {
    unlink.mockRestore();
  }
  const collision = Object.assign(new Error("synthetic-competing-backends"), { code: "EEXIST" });
  const link = spyOn(fs, "link").mockImplementation(async (_from, to) => {
    await fs.writeFile(to, "COMPETING_V2_CONTENT", { flag: "wx" });
    throw collision;
  });
  try {
    await expect(migrateRuntimeConfigs(root, true)).rejects.toBe(collision);
    expect(await fs.readFile(path.join(root, "runtime/backends.json"), "utf8")).toBe(
      "COMPETING_V2_CONTENT",
    );
    expect(await fs.readFile(path.join(root, "runtime/agents.json"), "utf8")).toBe(agents);
  } finally {
    link.mockRestore();
  }
});

test("actual --runtime CLI preview accepts two display locales without printing source values", async () => {
  for (const locale of ["zh-CN", "en"]) {
    const { root } = await setup();
    const child = Bun.spawn(
      [
        Bun.env.BUN_RUNTIME_EXECUTABLE ?? "bun",
        path.resolve(import.meta.dir, "../../../../../../apps/game/src/cli/migrate-configs.ts"),
        "--configs-dir",
        root,
        "--runtime",
        "--display-locale",
        locale,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toMatchObject({
      mode: "preview",
      schemaVersion: 2,
      backends: 2,
      agents: 3,
    });
    expect(stdout).not.toContain(secret);
    expect(stdout).not.toContain("MIGRATION_NOT_IN_ENV");
    expect((await fs.readdir(path.join(root, "runtime"))).sort()).toEqual([
      "agents.json",
      "providers.json",
    ]);
  }
});
