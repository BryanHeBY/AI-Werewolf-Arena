/** 负责首次空配置根的 HTTP 集成反例；输入隔离目录与合成认证，按字面预期核对空骨架、分步保存和已有文件保留。不会调用模型或读取个人配置。 */
import { test, expect } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createWorkbench } from "../../src/server/api";

test("validation and retired example import do not bootstrap or modify an empty config root", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-readonly-validation-"));
  try {
    const application = createWorkbench({
      repository: path.resolve(import.meta.dir, "../../../.."),
      configs: path.join(root, "configs"),
      records: path.join(root, "record"),
      jobs: path.join(root, "jobs"),
    });
    for (const kind of ["boards", "backends", "agents", "games"]) {
      const response = await application.fetch(
        new Request("http://127.0.0.1:4310/api/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, name: kind, text: "{}" }),
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ valid: false });
      expect(await fs.readdir(root)).toEqual([]);
    }
    const retired = await application.fetch(
      new Request("http://127.0.0.1:4310/api/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(retired.status).toBe(404);
    expect(await fs.readdir(root)).toEqual([]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("empty config startup creates only runtime skeletons without placeholder examples", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-empty-initialize-")),
    configs = path.join(root, "configs");
  try {
    const application = createWorkbench({
      repository: path.resolve(import.meta.dir, "../../../.."),
      configs,
      records: path.join(root, "record"),
      jobs: path.join(root, "jobs"),
      dist: path.join(root, "dist"),
    });
    const catalog = await application.fetch(new Request("http://127.0.0.1:4310/api/catalog"));
    expect(await catalog.json()).toMatchObject({ games: [], agents: [], backends: [] });
    expect(await fs.readdir(configs)).toEqual(["runtime"]);
    for (const kind of ["backends", "agents"])
      expect(
        JSON.parse(await fs.readFile(path.join(configs, `runtime/${kind}.json`), "utf8")),
      ).toEqual({ schemaVersion: 2, items: {} });
    expect(
      (
        await application.fetch(
          new Request("http://127.0.0.1:4310/api/initialize", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(404);
    const board = await application.fetch(
      new Request("http://127.0.0.1:4310/api/board-template/six_player_mvp?source=example"),
    );
    expect(board.status).toBe(200);
    expect(await fs.readdir(configs)).toEqual(["runtime"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("a fresh runtime accepts a connection before its first agent but still rejects incomplete games", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-first-agent-"));
  try {
    const options = {
      repository: path.resolve(import.meta.dir, "../../../.."),
      configs: path.join(root, "configs"),
      records: path.join(root, "record"),
      jobs: path.join(root, "jobs"),
    };
    const application = createWorkbench(options);
    const get = (relative: string) =>
      application.fetch(new Request(`http://127.0.0.1:4310/api/${relative}`));
    const put = (relative: string, body: unknown) =>
      application.fetch(
        new Request(`http://127.0.0.1:4310/api/${relative}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    // 直接进入向导也能拿到骨架；并发读取获得同一份有效 JSON 与 revision。
    const [first, second] = await Promise.all([
      get("documents/backends/backends"),
      get("documents/backends/backends"),
    ]);
    const backend = await first.json();
    expect(backend).toEqual(await second.json());
    const invalid = await put("documents/backends/backends", {
      revision: backend.revision,
      text: JSON.stringify({
        schemaVersion: 2,
        items: {
          pi: { kind: "pi", config: { models: { unsupported_native_flag: true }, auth: {} } },
        },
      }),
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: "pi_models_invalid" });
    const saved = await put("documents/backends/backends", {
      revision: backend.revision,
      text: JSON.stringify({
        schemaVersion: 2,
        items: {
          pi: {
            kind: "pi",
            config: {
              models: { providers: {} },
              auth: { openai: { type: "api_key", key: "synthetic-first-key" } },
            },
          },
        },
      }),
    });
    expect(saved.status).toBe(200);
    expect(await saved.text()).not.toContain("synthetic-first-key");
    const incomplete = await put("documents/games/first_game", {
      revision: null,
      text: '{"board":"six_player_mvp"}',
    });
    expect(incomplete.status).toBe(400);
    expect(await incomplete.json()).toMatchObject({ error: "runtime_config_empty_agents_items" });
    const agent = await (await get("documents/agents/agents")).json();
    const profile = {
      backend: "pi",
      options: { defaultProvider: "openai", defaultModel: "gpt-6-luna" },
    };
    const missingDefault = await put("documents/agents/agents", {
      revision: agent.revision,
      text: JSON.stringify({ schemaVersion: 2, items: { first: profile } }),
    });
    expect(missingDefault.status).toBe(400);
    const missingBackend = await put("documents/agents/agents", {
      revision: agent.revision,
      text: JSON.stringify({
        schemaVersion: 2,
        default: "first",
        items: { first: { ...profile, backend: "missing" } },
      }),
    });
    expect(missingBackend.status).toBe(400);
    expect(await missingBackend.json()).toMatchObject({
      error: "runtime_config_agent_backend_not_found",
    });
    expect(
      (
        await put("documents/agents/agents", {
          revision: agent.revision,
          text: JSON.stringify({ schemaVersion: 2, default: "first", items: { first: profile } }),
        })
      ).status,
    ).toBe(200);
    const restarted = createWorkbench(options);
    expect(
      await (await restarted.fetch(new Request("http://127.0.0.1:4310/api/catalog"))).json(),
    ).toMatchObject({
      defaultAgent: "first",
      agents: [{ name: "first", backend: "pi", kind: "pi" }],
      games: [],
    });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("bootstrap preserves existing credentials, empty files and malformed JSON instead of replacing them", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-runtime-preserve-"));
  try {
    const configs = path.join(root, "configs"),
      runtime = path.join(configs, "runtime");
    await fs.mkdir(runtime, { recursive: true });
    for (const bytes of [
      "",
      "{",
      '{"schemaVersion":2,"items":{"local":{"kind":"pi","config":{"auth":{"openai":{"type":"api_key","key":"synthetic-preserve"}}}}}}\n ',
    ]) {
      await fs.writeFile(path.join(runtime, "backends.json"), bytes);
      const application = createWorkbench({
        repository: path.resolve(import.meta.dir, "../../../.."),
        configs,
        records: path.join(root, "record"),
        jobs: path.join(root, "jobs"),
      });
      await application.fetch(new Request("http://127.0.0.1:4310/api/catalog"));
      expect(await fs.readFile(path.join(runtime, "backends.json"), "utf8")).toBe(bytes);
      expect(JSON.parse(await fs.readFile(path.join(runtime, "agents.json"), "utf8"))).toEqual({
        schemaVersion: 2,
        items: {},
      });
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
