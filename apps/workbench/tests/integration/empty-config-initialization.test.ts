/** 负责首次空配置根的HTTP集成反例；输入隔离目录与显式初始化请求，独立核对首次读取不写文件、初始化只补缺失项。不会调用模型或读取个人配置。 */
import { test, expect } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createWorkbench } from "../../src/server/api";
test("empty config startup is read only and explicit initialization preserves existing local files", async () => {
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
    expect(
      await fs.stat(configs).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
    const initialize = () =>
      application.fetch(
        new Request("http://127.0.0.1:4310/api/initialize", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://127.0.0.1:4310" },
          body: "{}",
        }),
      );
    expect((await initialize()).status).toBe(200);
    const target = path.join(configs, "games/six_player_mvp.json"),
      preserved = `${await fs.readFile(target, "utf8")}\n `;
    await fs.writeFile(target, preserved);
    expect((await initialize()).status).toBe(200);
    expect(await fs.readFile(target, "utf8")).toBe(preserved);
    expect(
      JSON.parse(await fs.readFile(path.join(configs, "runtime/backends.json"), "utf8"))
        .schemaVersion,
    ).toBe(2);
    const initialized = await (
      await application.fetch(new Request("http://127.0.0.1:4310/api/catalog"))
    ).json();
    expect(initialized.agents.length).toBeGreaterThan(0);
    expect(initialized.games).toContain("six_player_mvp");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
