import { afterEach, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveReplayInput } from "../../../scripts/replay-dev";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true })));
});

test("resolves a backend record session directory to its replay document", async () => {
  const root = await fs.mkdtemp("/tmp/awa-replay-input-");
  roots.push(root);
  const sessionDir = path.join(root, "session_1");
  await fs.mkdir(sessionDir);
  await fs.writeFile(path.join(sessionDir, "replay.json"), "{}", "utf-8");

  expect(resolveReplayInput(sessionDir)).toBe(path.join(sessionDir, "replay.json"));
});

test("still accepts a direct replay file", async () => {
  const root = await fs.mkdtemp("/tmp/awa-replay-input-");
  roots.push(root);
  const replayFile = path.join(root, "game.replay.json");
  await fs.writeFile(replayFile, "{}", "utf-8");

  expect(resolveReplayInput(replayFile)).toBe(replayFile);
});
