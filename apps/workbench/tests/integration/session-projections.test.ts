/**
 * 核对受损运行文件的公开摘要投影；输入独立临时根内的嵌套对象，输出只含合法标量的会话。
 * 测试不依赖当前进程授权，不把目录内未知 JSON 当作可信运行契约。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SessionStore } from "../../src/server/session-store";

test("damaged session metadata cannot export nested credentials through public summary fields", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-workbench-session-projection-"));
  const id = "session_damaged";
  try {
    await fs.mkdir(path.join(root, id));
    const nested = { authorization: "synthetic-private-metadata-only" };
    await fs.writeFile(
      path.join(root, id, "manifest.json"),
      JSON.stringify({
        session_id: id,
        board: "six_player_mvp",
        started_at: "2026-01-01",
        ended_at: nested,
        finish_reason: "runtime_error",
        winner: nested,
      }),
    );
    await fs.writeFile(
      path.join(root, id, "runtime.json"),
      JSON.stringify({
        schemaVersion: 1,
        sessionId: id,
        instanceId: "damaged",
        state: "failed",
        heartbeatAt: "2026-01-01",
        gameName: nested,
        origin: nested,
        endedAt: nested,
        errorCode: nested,
      }),
    );
    const entry = await new SessionStore(root).get(id);
    expect(entry).toMatchObject({ sessionId: id, state: "failed", canStop: false });
    expect(JSON.stringify(entry)).not.toContain("synthetic-private-metadata-only");
    for (const key of ["winner", "endedAt", "gameName", "origin", "errorCode"])
      expect(entry).not.toHaveProperty(key);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
