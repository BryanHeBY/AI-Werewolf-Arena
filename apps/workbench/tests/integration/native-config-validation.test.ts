/**
 * 集成测试负责核对工作台候选校验与真实启动前检查的一致性；输入独立临时 Pi JSON，不创建会话或模型请求。
 * 思考枚举、原生模型字段和环境占位原文使用手写预期；校验与保存不得将环境认证写回源文件。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { JsonObject } from "@ai-werewolf-arena/workbench-contract";
import { checkConfig } from "ai-werewolf-arena-backend/config/check";
import { ConfigDocuments } from "../../src/server/config-documents";
import { ConfigService } from "../../src/server/config-service";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-workbench-native-"));
  for (const part of ["runtime", "games", "boards"]) await fs.mkdir(path.join(root, part));
  const examples = path.resolve(import.meta.dir, "../../../../configs.example");
  const backends: JsonObject = {
    schemaVersion: 2,
    items: { pi: { kind: "pi", config: { models: { providers: {} }, auth: {} } } },
  };
  const agents: JsonObject = {
    schemaVersion: 2,
    default: "pi",
    items: {
      pi: { backend: "pi", options: { defaultProvider: "openai", defaultModel: "gpt-5.1" } },
    },
  };
  await fs.writeFile(path.join(root, "runtime/backends.json"), JSON.stringify(backends));
  await fs.writeFile(path.join(root, "runtime/agents.json"), JSON.stringify(agents));
  await fs.writeFile(path.join(root, "games/game.json"), '{"board":"six_player_mvp"}');
  await fs.copyFile(
    path.join(examples, "boards/six_player_mvp.json"),
    path.join(root, "boards/six_player_mvp.json"),
  );
  const documents = new ConfigDocuments(root);
  return { root, backends, agents, documents, service: new ConfigService(documents, examples) };
}

test("candidate native Pi thinking settings are rejected before save and by launch preflight", async () => {
  const context = await fixture();
  try {
    const invalid = structuredClone(context.agents);
    ((invalid.items as JsonObject).pi as JsonObject).options = {
      defaultProvider: "openai",
      defaultModel: "gpt-5.1",
      defaultThinkingLevel: "banana",
    };
    await expect(context.service.validate("agents", "agents", invalid)).rejects.toThrow(
      "pi_settings_thinking_invalid",
    );
    const file = path.join(context.root, "runtime/agents.json");
    await fs.writeFile(file, JSON.stringify(invalid));
    await expect(checkConfig(context.root, "game")).rejects.toThrow("pi_settings_thinking_invalid");
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});

test("candidate native model documents use the same adapter schema as launch preflight", async () => {
  const context = await fixture();
  try {
    const invalid = structuredClone(context.backends);
    (((invalid.items as JsonObject).pi as JsonObject).config as JsonObject).models = {
      unsupported_native_flag: true,
    };
    await expect(context.service.validate("backends", "backends", invalid)).rejects.toThrow(
      "pi_models_invalid",
    );
    await fs.writeFile(path.join(context.root, "runtime/backends.json"), JSON.stringify(invalid));
    await expect(checkConfig(context.root, "game")).rejects.toThrow("pi_models_invalid");
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});

test("native validation resolves a temporary credential while saved JSON keeps its placeholder", async () => {
  const context = await fixture();
  const variable = "AWA_WORKBENCH_NATIVE_TEST_KEY";
  const previous = process.env[variable];
  process.env[variable] = "synthetic-resolved-key-not-for-disk";
  try {
    const file = path.join(context.root, "runtime/backends.json");
    const raw = structuredClone(context.backends);
    (((raw.items as JsonObject).pi as JsonObject).config as JsonObject).auth = {
      openai: { type: "api_key", key: "${AWA_WORKBENCH_NATIVE_TEST_KEY}" },
    };
    const current = await context.documents.read("backends", "backends");
    await context.documents.save({ ...current, text: JSON.stringify(raw) }, (candidate) =>
      context.service.validate("backends", "backends", candidate),
    );
    const source = await fs.readFile(file, "utf8");
    expect(source).toContain("${AWA_WORKBENCH_NATIVE_TEST_KEY}");
    expect(source).not.toContain("synthetic-resolved-key-not-for-disk");
    await expect(checkConfig(context.root, "game")).resolves.toBeDefined();
  } finally {
    if (previous === undefined) delete process.env[variable];
    else process.env[variable] = previous;
    await fs.rm(context.root, { recursive: true, force: true });
  }
});
