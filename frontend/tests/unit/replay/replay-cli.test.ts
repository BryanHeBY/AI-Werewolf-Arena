import { ReplayLoadError } from "../../../src/replay/offline-replay";
import { expect, test } from "bun:test";
import path from "node:path";
import { replayCommandFailure } from "../../../scripts/cli_error";

async function command(script: string, args: string[]) {
  const child = Bun.spawn(
    [
      Bun.env.BUN_RUNTIME_EXECUTABLE ?? "bun",
      path.resolve(import.meta.dir, `../../../scripts/${script}`),
      ...args,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}
test("frontend replay CLI errors share local text and reject opaque error contents", () => {
  const foreign = Object.defineProperty(new Error(), "message", {
    get() {
      throw new Error("PRIVATE_CLI_CANARY");
    },
  });
  for (const locale of ["zh-CN", "en"] as const) {
    const result = replayCommandFailure(foreign, locale);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_CLI_CANARY");
    expect(result.code).toBe("replay_command_failed");
    expect(replayCommandFailure(new Error("replay_private_cli_canary"), locale).code).toBe(
      "replay_command_failed",
    );
    expect(result.message).toContain(
      locale === "en" ? "Offline replay command failed" : "离线复盘命令失败",
    );
  }
});
test("actual frontend commands render English failures without opening a browser or a dev server", async () => {
  for (const [script, args, expected] of [
    ["replay-dev.ts", ["--display-locale", "en"], "replay_dev_usage"],
    ["render-replay.ts", ["--locale", "en"], "replay_render_input_output_required"],
    [
      "render-replay.ts",
      [
        "--locale",
        "en",
        "--input",
        "tests/fixtures/sample.replay.json",
        "--output",
        "/tmp/unused-frame.png",
        "--frame=-1",
      ],
      "replay_frame_invalid",
    ],
  ] as const) {
    const result = await command(script, [...args]);
    expect(result.code).toBe(1);
    const report = JSON.parse(result.stderr);
    expect(report.code).toBe(expected);
    expect(report.message).not.toMatch(/[\u4e00-\u9fff]/);
    expect(result.stderr).not.toContain(" at ");
    expect(result.stdout).toBe("");
  }
});

test("CLI loader explanations only use owned whitelisted keys and numeric HTTP status", () => {
  let reads = 0;
  const error = new ReplayLoadError({ key: "replay.invalid_file" });
  Object.defineProperty(error, "messageRef", {
    get() {
      reads++;
      return { key: "replay.http_failed", parameters: { status: "PRIVATE_CLI_CANARY" } };
    },
  });
  expect(replayCommandFailure(error, "en").message).not.toContain("PRIVATE_CLI_CANARY");
  expect(reads).toBe(0);
  for (const ref of [
    { key: "replay.http_failed", parameters: { status: "PRIVATE_CLI_CANARY" } },
    { key: "replay.http_failed", parameters: { status: 999 } },
    { key: "replay.http_failed", parameters: { status: 401, secret: "PRIVATE_CLI_CANARY" } },
    { key: "cli.offline_failed", parameters: { code: "PRIVATE_CLI_CANARY" } },
    { key: "replay.invalid_file", parameters: { secret: "PRIVATE_CLI_CANARY" } },
  ]) {
    const poisoned = new ReplayLoadError({ key: "replay.invalid_file" });
    Object.defineProperty(poisoned, "messageRef", { value: ref });
    const safe = replayCommandFailure(poisoned, "en");
    expect(safe.message).toBe("Offline replay command failed (replay_command_failed).");
  }
  expect(
    replayCommandFailure(
      new ReplayLoadError({ key: "replay.http_failed", parameters: { status: 401 } }),
      "en",
    ).message,
  ).toBe("Unable to read replay (HTTP 401).");
  expect(
    replayCommandFailure(new ReplayLoadError({ key: "replay.invalid_file" }), "zh-CN").message,
  ).toBe("这不是 AI Werewolf Arena 的 replay.json 文件。");
});
