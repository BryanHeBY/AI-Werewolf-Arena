/** 集成测试负责核对真实指令组合与公开响应；按手写文本顺序和字段白名单独立断言，假认证仅落临时目录，预览不发牌、不联网、不保存草稿。 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createWorkbench } from "../../src/server/api";
import type { GameInstructionPreview, JsonObject } from "@ai-werewolf-arena/workbench-contract";

async function workspace() {
  const repository = path.resolve(import.meta.dir, "../../../.."),
    root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-instructions-preview-")),
    configs = path.join(root, "configs");
  await fs.mkdir(path.join(configs, "runtime"), { recursive: true });
  await fs.mkdir(path.join(configs, "boards"));
  await fs.copyFile(
    path.join(repository, "configs.example/boards/six_player_mvp.json"),
    path.join(configs, "boards/six_player_mvp.json"),
  );
  await fs.writeFile(
    path.join(configs, "runtime/backends.json"),
    JSON.stringify({
      schemaVersion: 2,
      items: {
        synthetic: { kind: "llm", config: { type: "openai", apiKey: "synthetic-not-for-browser" } },
      },
    }),
  );
  await fs.writeFile(
    path.join(configs, "runtime/agents.json"),
    JSON.stringify({
      schemaVersion: 2,
      default: "default_agent",
      items: Object.fromEntries(
        ["default_agent", "game_agent", "role_agent", "seat_agent"].map((name) => [
          name,
          {
            backend: "synthetic",
            options: { model: "synthetic-model" },
            customInstructions: { mode: "append", text: name + " instructions" },
          },
        ]),
      ),
    }),
  );
  const application = createWorkbench({
    repository,
    configs,
    records: path.join(root, "record"),
    jobs: path.join(root, "jobs"),
  });
  const preview = (game: JsonObject, seat: unknown = 2, role?: unknown) =>
    application.fetch(
      new Request("http://127.0.0.1:4310/api/preview-game", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game, seat, ...(role !== undefined ? { role } : {}) }),
      }),
    );
  return { root, configs, preview, close: () => fs.rm(root, { recursive: true, force: true }) };
}

test("preview uses seat → role → game → runtime agent selection and real instruction composition", async () => {
  const w = await workspace();
  try {
    const game: JsonObject = {
      board: "six_player_mvp",
      customInstructions: { mode: "append", text: "本局全员猫娘" },
    };
    const read = async (raw: JsonObject, role?: string) => {
      const response = await w.preview(raw, 2, role);
      expect(response.status).toBe(200);
      return (await response.json()) as GameInstructionPreview;
    };
    expect(await read(game)).toMatchObject({
      agent: { name: "default_agent", source: "runtime" },
      customInstructions: "default_agent instructions\n\n本局全员猫娘",
    });
    const withGame = { ...game, agent: "game_agent" };
    expect((await read(withGame)).agent).toEqual({ name: "game_agent", source: "game" });
    const withRole = {
      ...withGame,
      roles: {
        wolf: { agent: "role_agent", customInstructions: { mode: "append", text: "狼队策略" } },
      },
    };
    expect(await read(withRole, "wolf")).toMatchObject({
      agent: { name: "role_agent", source: "role" },
      customInstructions: "role_agent instructions\n\n本局全员猫娘\n\n狼队策略",
    });
    const withSeat = {
      ...withRole,
      players: {
        "2": {
          agent: "seat_agent",
          customInstructions: { mode: "replace", text: "只保留座位要求" },
        },
      },
    };
    const result = await read(withSeat, "wolf");
    expect(result).toMatchObject({
      agent: { name: "seat_agent", source: "seat" },
      customInstructions: "只保留座位要求",
    });
    expect(
      await read(
        { ...withSeat, players: { "2": { customInstructions: { mode: "clear" } } } },
        "wolf",
      ),
    ).toMatchObject({ customInstructions: null });
    expect(JSON.stringify(result)).not.toContain("synthetic-not-for-browser");
    expect(JSON.stringify(result)).not.toContain("apiKey");
    expect(JSON.stringify(result)).not.toContain("synthetic-model");
    expect(await fs.readdir(w.root)).toEqual(["configs"]);
    expect((await fs.readdir(w.configs)).sort()).toEqual(["boards", "runtime"]);
  } finally {
    await w.close();
  }
});

test("preview selects game language and reports fallback without rewriting the draft", async () => {
  const w = await workspace();
  try {
    const game: JsonObject = {
        board: "six_player_mvp",
        locale: "en",
        customInstructions: { mode: "replace", text: { "zh-CN": "中文回退指令" } },
      },
      before = JSON.stringify(game);
    const response = await w.preview(game);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      locale: "en",
      customInstructions: "中文回退指令",
      warnings: [{ code: "locale_prompt_fallback", severity: "warning" }],
    });
    expect(JSON.stringify(game)).toBe(before);
  } finally {
    await w.close();
  }
});

test("preview rejects impossible seats or roles and malformed drafts", async () => {
  const w = await workspace();
  try {
    for (const [seat, role] of [
      [0, undefined],
      [7, undefined],
      [1.5, undefined],
      [1, "knight"],
      [1, {}],
    ] as const) {
      const response = await w.preview({ board: "six_player_mvp" }, seat, role);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "invalid_preview_selection" });
    }
    const response = await w.preview(null as unknown as JsonObject);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_document" });
  } finally {
    await w.close();
  }
});
