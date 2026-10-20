/** 集成测试负责核对运行登记的身份、私有控制与终态；输入真实本机端口和临时目录，预期错误令牌拒绝且退出后不留活动控制。 */
import { afterEach, expect, spyOn, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { RunSession } from "../../../src/app/run-session";
import {
  cleanupTestTempDirectories,
  createTestTempDirectory,
} from "../../support/drivers/temp-directories";
afterEach(cleanupTestTempDirectories);
test("only the current private capability stops a run, then queued logs precede its terminal snapshot", async () => {
  const directory = await createTestTempDirectory("awa-run-registration-");
  let stops = 0;
  const run = await RunSession.open({
    sessionId: "session_unit",
    sessionDir: directory,
    board: "six_player_mvp",
    gameName: "test",
    origin: "cli",
    stop: () => {
      stops++;
    },
  });
  const control = run.metadata.control!;
  try {
    expect(
      (await fetch(control.url, { method: "POST", headers: { authorization: "Bearer wrong" } }))
        .status,
    ).toBe(403);
    expect(stops).toBe(0);
    expect(
      (
        await fetch(control.url, {
          method: "POST",
          headers: { authorization: `Bearer ${control.token}` },
        })
      ).status,
    ).toBe(200);
    expect(stops).toBe(1);
    run.append("\u001b[90mthinking\u001b[0m");
    run.state("finalizing");
  } finally {
    await run.finish("cancelled");
  }
  const metadata = JSON.parse(await fs.readFile(path.join(directory, "runtime.json"), "utf8"));
  expect(metadata.state).toBe("cancelled");
  expect(metadata.control).toBeUndefined();
  expect(metadata.endedAt).toBeString();
  const row = JSON.parse((await fs.readFile(path.join(directory, "console.jsonl"), "utf8")).trim());
  expect(row.seq).toBe(1);
  expect(row.text).toBe("\u001b[90mthinking\u001b[0m\n");
});

for (const failure of [new Error("synthetic transient console disk failure"), false])
  test(`a transient console write rejection ${failure === false ? "with a falsy reason " : ""}persists a failed runtime and still rejects`, async () => {
    const directory = await createTestTempDirectory("awa-run-registration-failure-");
    const run = await RunSession.open({
      sessionId: "session_write_failure",
      sessionDir: directory,
      board: "six_player_mvp",
      gameName: "test",
      origin: "cli",
      stop() {},
    });
    const original = fs.appendFile;
    let injected = false;
    const append = spyOn(fs, "appendFile").mockImplementation(async (file, data, options) => {
      if (!injected && file === path.join(directory, "console.jsonl")) {
        injected = true;
        throw failure;
      }
      await original(file, data, options);
    });
    let finished = false;
    try {
      run.append("lost line");
      run.append("later line survives");
      await expect(run.finish("completed")).rejects.toBe(failure);
      finished = true;
      const metadata = JSON.parse(await fs.readFile(path.join(directory, "runtime.json"), "utf8"));
      expect(metadata).toMatchObject({ state: "failed", errorCode: "run_recording_failed" });
      expect(metadata.control).toBeUndefined();
      const lines = (await fs.readFile(path.join(directory, "console.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(lines).toEqual([expect.objectContaining({ seq: 2, text: "later line survives\n" })]);
    } finally {
      append.mockRestore();
      if (!finished)
        try {
          await run.finish("failed");
        } catch {}
    }
  });
