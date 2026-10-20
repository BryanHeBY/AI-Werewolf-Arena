/**
 * 配置投影测试核对原生扩展、受损文档和认证头的读取边界；输入独立临时 JSON，预期由字面字段给出。
 * 不解析真实环境认证，不读取用户配置；目录摘要不能把未校验的扩展对象原样送入浏览器。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConfigDocuments } from "../../src/server/config-documents";
import { ConfigService } from "../../src/server/config-service";

test("native authorization headers stay masked and survive an unrelated edit", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-workbench-auth-projection-"));
  try {
    const documents = new ConfigDocuments(root);
    await fs.mkdir(path.join(root, "runtime"));
    const original = {
      items: {
        pi: {
          kind: "pi",
          config: {
            models: {
              providers: {
                custom: {
                  headers: {
                    Authorization: "Bearer synthetic-header-only",
                    "X-Api-Key": "${TEST_KEY}",
                  },
                  extraNativeField: { preserved: true },
                },
              },
            },
          },
        },
      },
    };
    await fs.writeFile(path.join(root, "runtime/backends.json"), JSON.stringify(original));
    const masked = await documents.read("backends", "backends");
    expect(masked.text).not.toContain("synthetic-header-only");
    expect(masked.text).toContain("${TEST_KEY}");
    const edit = JSON.parse(masked.text);
    edit.items.pi.limits = { maxConcurrent: 2 };
    await documents.save({ ...masked, text: JSON.stringify(edit) });
    expect(await documents.raw("backends", "backends")).toEqual({
      ...original,
      items: { pi: { ...original.items.pi, limits: { maxConcurrent: 2 } } },
    });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("catalog projects primitive fields even when a malformed document contains nested credentials", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-workbench-catalog-projection-"));
  try {
    await fs.mkdir(path.join(root, "runtime"));
    const credential = { apiKey: "synthetic-nested-only" };
    await fs.writeFile(
      path.join(root, "runtime/backends.json"),
      JSON.stringify({
        items: {
          broken: { kind: credential, config: credential },
        },
      }),
    );
    await fs.writeFile(
      path.join(root, "runtime/agents.json"),
      JSON.stringify({
        default: credential,
        items: {
          broken: {
            backend: "broken",
            options: {
              model: credential,
              defaultModel: credential,
              defaultProvider: credential,
            },
          },
        },
      }),
    );
    const service = new ConfigService(new ConfigDocuments(root), root);
    const summary = await service.summary();
    expect(JSON.stringify(summary)).not.toContain("synthetic-nested-only");
    expect(summary.agents).toEqual([
      { name: "broken", backend: "broken", kind: undefined, model: undefined, provider: undefined },
    ]);
    expect(summary.defaultAgent).toBeUndefined();
    await expect(service.validate("unknown" as never, "one", {})).rejects.toMatchObject({
      code: "invalid_config_name",
    });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("source editing repairs broken JSON, while an unrecoverable credential mask still requires reentry", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-workbench-broken-json-"));
  try {
    await fs.mkdir(path.join(root, "games"));
    await fs.mkdir(path.join(root, "runtime"));
    await fs.writeFile(path.join(root, "games/broken.json"), "{");
    await fs.writeFile(path.join(root, "runtime/backends.json"), "{");
    const documents = new ConfigDocuments(root);
    const game = await documents.read("games", "broken");
    await documents.save({ ...game, text: '{"board":"six_player_mvp"}' });
    expect(await documents.raw("games", "broken")).toEqual({ board: "six_player_mvp" });
    const backend = await documents.read("backends", "backends", true);
    await expect(
      documents.save({ ...backend, text: '{"apiKey":"__AWA_UNCHANGED_SECRET__"}' }),
    ).rejects.toMatchObject({ code: "secret_reentry_required" });
    expect(await fs.readFile(path.join(root, "runtime/backends.json"), "utf8")).toBe("{");
    await documents.save({ ...backend, text: '{"apiKey":"synthetic-repaired-only"}' });
    expect((await documents.raw("backends", "backends")).apiKey).toBe("synthetic-repaired-only");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
