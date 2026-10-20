/**
 * 集成测试负责核对启动失败日志与会话游标的衔接；输入手写 manifest、启动登记和半行 JSONL。
 * 字面预期确保失败原因可见、真实日志优先、半行不丢失，并拒绝摘要中嵌套的私有认证对象。
 * 仅使用独立临时目录，不启动游戏、读取认证或访问网络。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { RunManager } from "../../src/server/run-manager";
import { SessionStore } from "../../src/server/session-store";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-startup-diagnostics-"));
  const id = "session_startup_diagnostics";
  const directory = path.join(root, "record", id);
  const jobs = path.join(root, "jobs");
  await fs.mkdir(directory, { recursive: true });
  await fs.mkdir(jobs);
  await fs.writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify({
      session_id: id,
      board: "six_player_mvp",
      started_at: "2026-01-01T00:00:00.000Z",
      ended_at: "2026-01-01T00:01:00.000Z",
      finish_reason: "runtime_error",
    }),
  );
  const job = {
    sessionId: id,
    board: "six_player_mvp",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:01:00.000Z",
    state: "failed",
    game: "unfinished",
    recording: "partial",
    canStop: false,
    canReplay: false,
  };
  const jobFile = path.join(jobs, `${id}.json`);
  const startupFile = path.join(jobs, `${id}.startup.log`);
  await fs.writeFile(jobFile, JSON.stringify(job));
  await fs.writeFile(startupFile, "runtime registration failed: diagnostic-sentinel");
  const manager = new RunManager(
    root,
    path.join(root, "configs"),
    new SessionStore(path.join(root, "record")),
    jobs,
  );
  return { root, id, directory, job, jobFile, startupFile, manager };
}

test("an existing manifest does not hide terminal startup failure diagnostics", async () => {
  const context = await fixture();
  try {
    for (const state of ["missing", "empty"] as const) {
      if (state === "empty") await fs.writeFile(path.join(context.directory, "console.jsonl"), "");
      const page = await context.manager.logs(context.id, 0);
      expect(page).toEqual({
        chunks: [
          {
            seq: 1,
            timestamp: context.job.endedAt,
            text: "runtime registration failed: diagnostic-sentinel",
          },
        ],
        cursor: 1,
      });
      expect(await context.manager.logs(context.id, 1)).toEqual({ chunks: [], cursor: 1 });
    }
    await fs.writeFile(
      context.startupFile,
      "prefix-must-not-appear" + "x".repeat(70000) + "final-error",
    );
    const tail = await context.manager.logs(context.id, 0);
    expect(tail.chunks[0]!.text).toHaveLength(65536);
    expect(tail.chunks[0]!.text).not.toContain("prefix-must-not-appear");
    expect(tail.chunks[0]!.text.endsWith("final-error")).toBe(true);
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});

test("partial and complete session log rows retain priority over the startup fallback", async () => {
  const context = await fixture();
  try {
    const consoleFile = path.join(context.directory, "console.jsonl");
    await fs.writeFile(consoleFile, '{"seq":1,"timestamp":"one",');
    expect(await context.manager.logs(context.id, 0)).toEqual({ chunks: [], cursor: 0 });
    await fs.appendFile(consoleFile, '"text":"real session output"}\n');
    expect(await context.manager.logs(context.id, 0)).toEqual({
      chunks: [{ seq: 1, timestamp: "one", text: "real session output" }],
      cursor: 1,
    });
    expect(await context.manager.logs(context.id, 1)).toEqual({ chunks: [], cursor: 1 });
    await fs.rm(consoleFile);
    await fs.writeFile(
      context.jobFile,
      JSON.stringify({ ...context.job, state: "starting", startedAt: new Date().toISOString() }),
    );
    expect(await context.manager.logs(context.id, 0)).toEqual({ chunks: [], cursor: 0 });
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});

test("job summaries accept only contract scalars and keep nested private values out", async () => {
  const context = await fixture();
  try {
    const privateValue = { authorization: "private-job-sentinel" };
    await fs.writeFile(
      context.jobFile,
      JSON.stringify({
        ...context.job,
        gameName: privateValue,
        endedAt: privateValue,
        errorCode: privateValue,
        winner: privateValue,
        origin: privateValue,
        game: privateValue,
        recording: privateValue,
        canStop: privateValue,
        canReplay: privateValue,
        launcher: privateValue,
      }),
    );
    const jobs = await context.manager.jobs();
    expect(jobs).toEqual([
      {
        sessionId: context.id,
        board: "six_player_mvp",
        startedAt: context.job.startedAt,
        state: "failed",
        game: "unknown",
        recording: "partial",
        canStop: false,
        canReplay: false,
      },
    ]);
    expect(JSON.stringify(jobs)).not.toContain("private-job-sentinel");
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});
