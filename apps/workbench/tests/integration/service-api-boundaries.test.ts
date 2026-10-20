/**
 * 集成测试负责 HTTP 配置与运行边界；输入独立临时根和字面请求，输出由手写状态码及保留文件断言。
 * 不启动模型或游戏；外部合法改写、删除源区分和同源限制均使用真实配置文件验证。
 */
import { test, expect } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createWorkbench } from "../../src/server/api";
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-service-api-")),
    repository = path.resolve(import.meta.dir, "../../../..");
  const configs = path.join(root, "configs");
  for (const kind of ["runtime", "boards", "games"])
    await fs.mkdir(path.join(configs, kind), { recursive: true });
  await fs.copyFile(
    path.join(repository, "configs.example/boards/six_player_mvp.json"),
    path.join(configs, "boards/six_player_mvp.json"),
  );
  await fs.writeFile(
    path.join(configs, "runtime/backends.json"),
    JSON.stringify({
      schemaVersion: 2,
      items: { llm: { kind: "llm", config: { type: "openai", apiKey: "synthetic-test-only" } } },
    }),
  );
  await fs.writeFile(
    path.join(configs, "runtime/agents.json"),
    JSON.stringify({
      schemaVersion: 2,
      default: "llm",
      items: { llm: { backend: "llm", options: { model: "offline" } } },
    }),
  );
  await fs.writeFile(
    path.join(configs, "games/game.json"),
    JSON.stringify({
      board: "six_player_mvp",
      agent: "llm",
      roles: { wolf: { agent: "llm" } },
      players: { "1": { agent: "llm", customInstructions: { text: "must-not-project" } } },
    }),
  );
  const app = createWorkbench({
    repository,
    configs,
    records: path.join(root, "record"),
    jobs: path.join(root, "jobs"),
  });
  const request = (url: string, method = "GET", body?: unknown, origin = "http://127.0.0.1:4310") =>
    app.fetch(
      new Request(`http://127.0.0.1:4310/api/${url}`, {
        method,
        headers: { "content-type": "application/json", origin },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  return { root, configs, app, request };
}
test("catalog revisions bind quick start to visible files and missing local boards are never silently copied", async () => {
  const f = await fixture();
  try {
    const catalog = await (await f.request("catalog")).json();
    const card = catalog.gameCards[0];
    expect(card).toMatchObject({
      id: "game",
      source: "local",
      board: "six_player_mvp",
      size: 6,
      defaultAgent: "llm",
      roleAgents: { wolf: "llm" },
      seatAgents: { "1": "llm" },
    });
    expect(JSON.stringify(catalog)).not.toContain("must-not-project");
    expect(JSON.stringify(catalog)).not.toContain("synthetic-test-only");
    await fs.writeFile(
      path.join(f.configs, "games/game.json"),
      JSON.stringify({ board: "six_player_mvp", agent: "llm", seed: "external" }),
    );
    let response = await f.request("runs", "POST", { gameName: "game", revision: card.revision });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("config_conflict");
    expect((await f.request("runs", "POST", { gameName: "game" })).status).toBe(400);
    const current = await f.app.documents.read("games", "game");
    await fs.rm(path.join(f.configs, "boards/six_player_mvp.json"));
    response = await f.request("runs", "POST", { gameName: "game", revision: current.revision });
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("config_not_found");
    expect(await f.app.documents.list("boards")).toEqual([]);
    expect(await f.app.runs.jobs()).toEqual([]);
  } finally {
    await fs.rm(f.root, { recursive: true, force: true });
  }
});
test("HTTP deletion validates origins, revision and references before touching local source files", async () => {
  const f = await fixture();
  try {
    const board = await f.app.documents.read("boards", "six_player_mvp");
    let response = await f.request(
      "documents/boards/six_player_mvp",
      "DELETE",
      { revision: board.revision },
      "https://unrelated.invalid",
    );
    expect(response.status).toBe(403);
    response = await f.request("documents/boards/six_player_mvp", "DELETE", {
      revision: board.revision,
    });
    expect(response.status).toBe(409);
    expect((await response.json()).references).toEqual(["game"]);
    const game = await f.app.documents.read("games", "game");
    expect(
      (await f.request("documents/games/game", "DELETE", { revision: game.revision })).status,
    ).toBe(200);
    expect(
      (await f.request("documents/boards/six_player_mvp", "DELETE", { revision: board.revision }))
        .status,
    ).toBe(200);
    expect(await f.app.documents.list("boards")).toEqual([]);
    expect((await f.request("catalog")).status).toBe(200);
    expect(await f.app.documents.list("boards")).toEqual([]);
    expect((await f.request("documents/boards/six_player_mvp")).status).toBe(404);
  } finally {
    await fs.rm(f.root, { recursive: true, force: true });
  }
});
test("initialization preserves a separate example library when a local board has the same ID", async () => {
  const f = await fixture();
  try {
    const example = await (await f.request("board-template/six_player_mvp?source=example")).json();
    const original = await f.app.documents.read("boards", "six_player_mvp");
    const local = JSON.parse(original.text);
    local.rules.winConditions = ["wolf_reach_half", "slaughter_city"];
    await f.app.documents.save({ ...original, text: JSON.stringify(local) }, (value) =>
      f.app.configs.validate("boards", "six_player_mvp", value),
    );
    expect((await f.request("initialize", "POST", {})).status).toBe(200);
    const catalog = await (await f.request("catalog")).json();
    expect(
      catalog.boards.find((board: { id: string }) => board.id === "six_player_mvp"),
    ).toMatchObject({
      source: "local",
      supported: true,
      rules: { winConditions: ["wolf_reach_half", "slaughter_city"] },
    });
    expect(
      catalog.boardTemplates.find((board: { id: string }) => board.id === "six_player_mvp"),
    ).toMatchObject({
      source: "example",
      supported: true,
      rules: { winConditions: ["slaughter_city", "wolf_reach_half"] },
    });
    expect(await (await f.request("board-template/six_player_mvp?source=example")).json()).toEqual(
      example,
    );
    expect(await (await f.request("board-template/six_player_mvp")).json()).toEqual(local);
    expect((await f.request("board-template/six_player_mvp?source=invalid")).status).toBe(400);
  } finally {
    await fs.rm(f.root, { recursive: true, force: true });
  }
});
