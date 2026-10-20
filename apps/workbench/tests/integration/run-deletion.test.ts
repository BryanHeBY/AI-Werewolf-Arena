/** 测试负责核对服务文件与身份边界；输入独立临时文件或字面数据，输出由手写独立预期断言。
 * 不读取用户配置与认证，不触碰真实录制或 output；字节预算用于验证分页成本。 */
import { test, expect } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readBootId, readProcessIdentity } from "@ai-werewolf-arena/game-runtime/run-session";
import { RunManager } from "../../src/server/run-manager";
import { SessionStore } from "../../src/server/session-store";
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-delete-run-"));
  const records = path.join(root, "record"),
    jobs = path.join(root, "jobs"),
    id = "session_delete";
  const directory = path.join(records, id);
  await fs.mkdir(directory, { recursive: true });
  await fs.mkdir(jobs);
  const manifest = {
    session_id: id,
    board: "six_player_mvp",
    started_at: "2026-01-01",
    ended_at: "2026-01-02",
    finish_reason: "cancelled",
  };
  await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest));
  await fs.writeFile(path.join(directory, "replay.json"), "{}");
  const manager = new RunManager(root, path.join(root, "configs"), new SessionStore(records), jobs);
  return {
    root,
    records,
    jobs,
    id,
    directory,
    manifest,
    manager,
    entry: async () => (await manager.list()).find((e) => e.sessionId === id)!,
  };
}
test("deletion removes only selected session and matching jobs, while external changes and repeats conflict", async () => {
  const f = await fixture();
  try {
    await fs.mkdir(path.join(f.records, "session_keep"));
    await fs.writeFile(path.join(f.records, "session_keep/keep"), "other-session");
    await fs.mkdir(path.join(f.root, "output"));
    await fs.writeFile(path.join(f.root, "output/keep"), "output-sentinel");
    await fs.writeFile(path.join(f.jobs, `${f.id}.startup.log`), "startup");
    const before = await f.entry();
    expect(before.canDelete).toBe(true);
    await fs.writeFile(
      path.join(f.directory, "manifest.json"),
      JSON.stringify({ ...f.manifest, winner: "good" }),
    );
    await expect(f.manager.delete(f.id, before.revision!)).rejects.toMatchObject({
      code: "run_conflict",
    });
    const current = await f.entry();
    await f.manager.delete(f.id, current.revision!);
    expect(await Bun.file(path.join(f.directory, "replay.json")).exists()).toBe(false);
    expect(await Bun.file(path.join(f.jobs, `${f.id}.startup.log`)).exists()).toBe(false);
    expect(await fs.readFile(path.join(f.records, "session_keep/keep"), "utf8")).toBe(
      "other-session",
    );
    expect(await fs.readFile(path.join(f.root, "output/keep"), "utf8")).toBe("output-sentinel");
    await expect(f.manager.delete(f.id, current.revision!)).rejects.toMatchObject({
      code: "run_not_found",
    });
  } finally {
    await fs.rm(f.root, { recursive: true, force: true });
  }
});
test("stale heartbeat, foreign owner and unknown legacy run cannot authorize deletion", async () => {
  const f = await fixture();
  try {
    const runtime = {
      schemaVersion: 1,
      sessionId: f.id,
      instanceId: "test",
      state: "running",
      heartbeatAt: "2000-01-01",
      host: os.hostname(),
      pid: process.pid,
      bootId: await readBootId(),
      processStart: await readProcessIdentity(process.pid),
    };
    await fs.writeFile(path.join(f.directory, "runtime.json"), JSON.stringify(runtime));
    let e = await f.entry();
    expect(e).toMatchObject({ canDelete: false, deleteBlock: "run_still_alive" });
    await expect(f.manager.delete(f.id, e.revision!)).rejects.toMatchObject({
      code: "run_still_alive",
    });
    await fs.writeFile(
      path.join(f.directory, "runtime.json"),
      JSON.stringify({ ...runtime, host: "foreign" }),
    );
    e = await f.entry();
    expect(e).toMatchObject({ canDelete: false, deleteBlock: "run_liveness_unknown" });
    await fs.rm(path.join(f.directory, "runtime.json"));
    await fs.writeFile(
      path.join(f.directory, "manifest.json"),
      JSON.stringify({ ...f.manifest, finish_reason: "in_progress" }),
    );
    e = await f.entry();
    expect(e).toMatchObject({ canDelete: false, deleteBlock: "run_liveness_unknown" });
    await fs.writeFile(
      path.join(f.directory, "runtime.json"),
      JSON.stringify({ ...runtime, processStart: "earlier-owner" }),
    );
    expect((await f.entry()).canDelete).toBe(true);
  } finally {
    await fs.rm(f.root, { recursive: true, force: true });
  }
});
test("nested links reject deletion and preserve target and recorded files", async () => {
  const f = await fixture();
  try {
    const outside = path.join(f.root, "keep");
    await fs.writeFile(outside, "safe");
    await fs.symlink(outside, path.join(f.directory, "link"));
    const e = await f.entry();
    await expect(f.manager.delete(f.id, e.revision!)).rejects.toMatchObject({
      code: "symlink_not_allowed",
    });
    expect(await fs.readFile(outside, "utf8")).toBe("safe");
    expect(await Bun.file(path.join(f.directory, "replay.json")).exists()).toBe(true);
  } finally {
    await fs.rm(f.root, { recursive: true, force: true });
  }
});
test("a mismatched or malformed job cannot be deleted as an associated run", async () => {
  const f = await fixture();
  try {
    for (const job of [{}, { sessionId: "session_other", state: "failed" }]) {
      await fs.writeFile(path.join(f.jobs, `${f.id}.json`), JSON.stringify(job));
      const entry = await f.entry();
      expect(entry).toMatchObject({ canDelete: false, deleteBlock: "run_liveness_unknown" });
      await expect(f.manager.delete(f.id, entry.revision!)).rejects.toMatchObject({
        code: "run_liveness_unknown",
      });
      expect(JSON.parse(await fs.readFile(path.join(f.jobs, `${f.id}.json`), "utf8"))).toEqual(job);
    }
  } finally {
    await fs.rm(f.root, { recursive: true, force: true });
  }
});
