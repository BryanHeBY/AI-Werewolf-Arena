/**
 * 路径单元测试以独立临时目录和手写绝对路径为预期，核对入口、声明文件与工具根的不同基准。
 * 仅验证定位与缺失文件错误，不读取个人配置，不运行模型或修改项目数据。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import os from "node:os";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import {
  PROJECT_ROOT,
  applicationDirectory,
  applicationResource,
  projectDataPath,
  resolveInputPath,
  resolveDeclaredPath,
  resolveReplayInput,
} from "../src";

test("defaults and application resources keep a stable project owner", () => {
  expect(projectDataPath("record")).toBe(path.join(PROJECT_ROOT, "record"));
  expect(projectDataPath("configs")).toBe(path.join(PROJECT_ROOT, "configs"));
  expect(applicationDirectory("replay")).toBe(path.join(PROJECT_ROOT, "apps", "replay"));
  expect(applicationResource("game", "src", "cli", "run-game.ts")).toBe(
    path.join(PROJECT_ROOT, "apps", "game", "src", "cli", "run-game.ts"),
  );
});

test("explicit inputs follow invocation cwd while file references follow their declaration", () => {
  const invocation = path.join(os.tmpdir(), "awa caller with spaces");
  const declaringFile = path.join(os.tmpdir(), "awa project elsewhere", "config.json");
  expect(resolveInputPath("./session/replay.json", invocation)).toBe(
    path.join(invocation, "session", "replay.json"),
  );
  expect(resolveDeclaredPath("./session/replay.json", declaringFile)).toBe(
    path.join(path.dirname(declaringFile), "session", "replay.json"),
  );
  const absolute = path.join(os.tmpdir(), "absolute replay.json");
  expect(resolveInputPath(absolute, invocation)).toBe(absolute);
  expect(resolveDeclaredPath(absolute, declaringFile)).toBe(absolute);
});

test("a replay directory resolves only its own file and reports the actual missing path", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa replay path "));
  try {
    await mkdir(path.join(directory, "session"));
    await writeFile(path.join(directory, "session", "replay.json"), "{}");
    expect(resolveReplayInput("session", directory)).toBe(
      path.join(directory, "session", "replay.json"),
    );
    expect(() => resolveReplayInput("missing", directory)).toThrow(path.join(directory, "missing"));
    expect(() => resolveReplayInput(".", directory)).toThrow(path.join(directory, "replay.json"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
