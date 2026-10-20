/**
 * 集成测试负责验证配置 API、真实公共 CLI 和录制发现的闭环；输入合成本机模型与独立临时根。
 * 独立预期核对私有令牌不公开、来源校验、外部运行停止及最终回执，不调用计费服务。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { applicationResource } from "@ai-werewolf-arena/project-paths";
import type { SessionEntry } from "@ai-werewolf-arena/workbench-contract";
import { offlineWorkspace, eventually } from "../support/offline-workspace";
test("API rejects cross-origin writes and exposes supported boards without credentials", async () => {
  const workspace = await offlineWorkspace();
  try {
    const response = await workspace.application.fetch(
      new Request("http://127.0.0.1:4310/api/initialize", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://unrelated.invalid" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(403);
    const catalog = await workspace.application.fetch(
      new Request("http://127.0.0.1:4310/api/catalog"),
    );
    const text = await catalog.text();
    expect(text).not.toContain("synthetic-test-only");
    expect(text).toContain("six_player_mvp");
    expect(text).toContain("offline-model");
  } finally {
    await workspace.close();
  }
});
test("workbench launch creates a terminal recording and publishes a completion receipt", async () => {
  const workspace = await offlineWorkspace();
  let id: string | undefined;
  try {
    id = await workspace.application.runs.start("offline_game");
    const record = await eventually(
      () => workspace.application.sessions.get(id!),
      (entry) => !!entry && !["starting", "running", "finalizing"].includes(entry.state),
      20000,
    );
    expect(record!.origin).toBe("workbench");
    expect(record!.canStop).toBe(false);
    expect(record!.canReplay).toBe(true);
    expect(record!.recording).toBe("complete");
    const logs = await workspace.application.sessions.logs(id, 0);
    expect(logs.chunks.length).toBeGreaterThan(0);
    expect(logs.chunks.map((c) => c.text).join("")).toContain("[run_game] start");
    expect(JSON.stringify(await workspace.application.runs.list())).not.toContain('"token"');
    expect(
      JSON.parse(await fs.readFile(path.join(workspace.records, id, "completion.json"), "utf8"))
        .sessionId,
    ).toBe(id);
  } finally {
    if (id) {
      try {
        await workspace.application.sessions.stop(id);
      } catch {}
    }
    await workspace.close();
  }
}, 30000);
test("externally launched CLI games are discoverable and stop through the same private control channel", async () => {
  const workspace = await offlineWorkspace();
  workspace.slow();
  const child = Bun.spawn(
    [
      process.execPath,
      applicationResource("game", "src/cli/run-game.ts"),
      "--configs-dir",
      workspace.configs,
      "--game-config-name",
      "offline_game",
      "--record-root-dir",
      workspace.records,
    ],
    {
      cwd: workspace.repository,
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      env: { ...process.env, AWA_RUN_ORIGIN: "cli", AWA_SESSION_ID: undefined },
    },
  );
  try {
    const records = await eventually(
      () => workspace.application.sessions.list(),
      (entries) => entries.some((e) => e.canStop),
      15000,
    );
    const record = records.find((e) => e.canStop)!;
    expect(record.origin).toBe("cli");
    await eventually(
      async () => workspace.requestCount(),
      (count) => count > 0,
      10000,
    );
    await workspace.application.sessions.stop(record.sessionId);
    await child.exited;
    const ended = await workspace.application.sessions.get(record.sessionId);
    expect(ended!.state).toBe("cancelled");
    expect(ended!.canStop).toBe(false);
    expect(ended!.recording).toBe("complete");
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await child.exited;
    }
    await workspace.close();
  }
}, 30000);
