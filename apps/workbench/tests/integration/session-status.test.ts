/** 集成测试负责核对历史录制、崩溃租约和半行日志的读取；输入手写文件，字面预期区分终局、存活与发布状态。 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readBootId, readProcessIdentity } from "ai-werewolf-arena-backend/run-session";
import { SessionStore } from "../../src/server/session-store";
import { RunManager } from "../../src/server/run-manager";
test("legacy end timestamps do not imply liveness or current publication", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-record-status-")),
    id = "session_old";
  try {
    await fs.mkdir(path.join(root, id));
    await fs.writeFile(
      path.join(root, id, "manifest.json"),
      JSON.stringify({
        session_id: id,
        board: "six_player_mvp",
        started_at: "2026-01-01",
        ended_at: "2026-01-01",
        finish_reason: "in_progress",
        winner: null,
      }),
    );
    await fs.writeFile(path.join(root, id, "replay.json"), "{}");
    const store = new SessionStore(root),
      entry = await store.get(id);
    expect(entry).toMatchObject({
      state: "legacy",
      game: "unknown",
      recording: "legacy",
      canStop: false,
    });
    expect(entry!.endedAt).toBeUndefined();
    await fs.writeFile(
      path.join(root, id, "console.jsonl"),
      '{"seq":1,"timestamp":"one","text":"hello"}\n{"seq":2',
    );
    expect(await store.logs(id, 0)).toEqual({
      chunks: [{ seq: 1, timestamp: "one", text: "hello" }],
      cursor: 1,
    });
    await fs.appendFile(
      path.join(root, id, "console.jsonl"),
      ',"timestamp":"two","text":"world"}\n',
    );
    expect((await store.logs(id, 1)).cursor).toBe(2);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("reused process identities and foreign hosts cannot authorize a stale run", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-record-identity-"));
  const id = "session_identity";
  const directory = path.join(root, id);
  try {
    await fs.mkdir(directory);
    await fs.writeFile(
      path.join(directory, "manifest.json"),
      JSON.stringify({
        session_id: id,
        board: "six_player_mvp",
        started_at: "2026-01-01T00:00:00.000Z",
        finish_reason: "in_progress",
        winner: null,
      }),
    );
    const runtime = {
      schemaVersion: 1,
      sessionId: id,
      instanceId: "original-instance",
      pid: process.pid,
      processStart: "not-the-current-process-start",
      host: os.hostname(),
      bootId: await readBootId(),
      origin: "cli",
      gameName: "offline_game",
      state: "running",
      heartbeatAt: new Date().toISOString(),
      control: { url: "http://127.0.0.1:1/stop", token: "private-capability" },
    };
    const store = new SessionStore(root);
    await fs.writeFile(path.join(directory, "runtime.json"), JSON.stringify(runtime));
    expect(await store.get(id)).toMatchObject({
      state: "interrupted",
      recording: "partial",
      canStop: false,
    });
    await expect(store.stop(id)).rejects.toMatchObject({ code: "run_not_controllable" });

    await fs.writeFile(
      path.join(directory, "runtime.json"),
      JSON.stringify({ ...runtime, host: "a-different-computer" }),
    );
    expect(await store.get(id)).toMatchObject({ state: "lost", canStop: false });

    // PID 相同不足以授权；只有启动时刻与本机 boot ID 同时匹配，才允许控制。
    const current = { ...runtime, processStart: await readProcessIdentity(process.pid) };
    await fs.writeFile(path.join(directory, "runtime.json"), JSON.stringify(current));
    expect(await store.get(id)).toMatchObject({
      state: "running",
      recording: "running",
      canStop: true,
    });
    await fs.writeFile(
      path.join(directory, "runtime.json"),
      JSON.stringify({ ...current, heartbeatAt: new Date(Date.now() - 60000).toISOString() }),
    );
    const stale = await store.get(id);
    expect(stale).toMatchObject({ state: "lost", recording: "partial", canStop: true });
    expect(JSON.stringify(stale)).not.toContain("private-capability");
    expect(JSON.stringify(stale)).not.toContain('"control"');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("completion requires the same finalized manifest and every declared nonempty core artifact", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-record-receipt-"));
  const id = "session_receipt";
  const directory = path.join(root, id);
  const endedAt = "2026-01-01T00:01:00.000Z";
  try {
    await fs.mkdir(directory);
    await fs.writeFile(
      path.join(directory, "manifest.json"),
      JSON.stringify({
        session_id: id,
        board: "six_player_mvp",
        started_at: "2026-01-01T00:00:00.000Z",
        ended_at: endedAt,
        finish_reason: "cancelled",
        winner: null,
      }),
    );
    await fs.writeFile(path.join(directory, "replay.json"), "{}");
    const receipt = {
      schemaVersion: 1,
      sessionId: id,
      endedAt,
      files: ["manifest.json", "replay.json", "reproduction.json"],
    };
    const store = new SessionStore(root);
    await fs.writeFile(path.join(directory, "completion.json"), JSON.stringify(receipt));
    expect(await store.get(id)).toMatchObject({
      recording: "partial",
      game: "unfinished",
      canReplay: true,
      canStop: false,
    });
    await fs.writeFile(path.join(directory, "reproduction.json"), "");
    expect((await store.get(id))!.recording).toBe("partial");
    await fs.writeFile(path.join(directory, "reproduction.json"), "{}");
    expect((await store.get(id))!.recording).toBe("complete");

    await fs.rm(path.join(directory, "reproduction.json"));
    await fs.mkdir(path.join(directory, "reproduction.json"));
    expect((await store.get(id))!.recording).toBe("partial");
    await fs.rmdir(path.join(directory, "reproduction.json"));
    await fs.writeFile(path.join(directory, "reproduction.json"), "{}");

    await fs.writeFile(
      path.join(directory, "completion.json"),
      JSON.stringify({ ...receipt, endedAt: "2026-01-02T00:00:00.000Z" }),
    );
    expect((await store.get(id))!.recording).toBe("partial");
    await fs.writeFile(
      path.join(directory, "completion.json"),
      JSON.stringify({ ...receipt, files: [...receipt.files, "../other.json"] }),
    );
    expect((await store.get(id))!.recording).toBe("partial");
    await fs.writeFile(
      path.join(directory, "completion.json"),
      JSON.stringify({ ...receipt, sessionId: "session_another" }),
    );
    expect((await store.get(id))!.recording).toBe("partial");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("expired startup jobs do not stay starting or expose their launcher identity", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-startup-lease-"));
  const jobs = path.join(root, "jobs");
  try {
    await fs.mkdir(jobs);
    const launcher = {
      pid: process.pid,
      processStart: await readProcessIdentity(process.pid),
      bootId: await readBootId(),
      host: os.hostname(),
    };
    const base = {
      board: "six_player_mvp",
      gameName: "offline_game",
      origin: "workbench",
      startedAt: new Date(Date.now() - 60000).toISOString(),
      state: "starting",
      game: "unfinished",
      recording: "partial",
      canStop: false,
      canReplay: false,
    };
    const liveId = "session_live_startup";
    const deadId = "session_dead_startup";
    await fs.writeFile(
      path.join(jobs, `${liveId}.json`),
      JSON.stringify({ ...base, sessionId: liveId, launcher }),
    );
    await fs.writeFile(
      path.join(jobs, `${deadId}.json`),
      JSON.stringify({
        ...base,
        sessionId: deadId,
        launcher: { ...launcher, processStart: "a-previous-process-with-this-pid" },
      }),
    );
    const manager = new RunManager(root, path.join(root, "configs"), new SessionStore(root), jobs);
    const records = await manager.list();
    expect(records.find((entry) => entry.sessionId === liveId)).toMatchObject({
      state: "lost",
      canStop: false,
    });
    expect(records.find((entry) => entry.sessionId === deadId)).toMatchObject({
      state: "interrupted",
      canStop: false,
    });
    expect(JSON.stringify(records)).not.toContain('"launcher"');
    expect(JSON.stringify(records)).not.toContain('"processStart"');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
