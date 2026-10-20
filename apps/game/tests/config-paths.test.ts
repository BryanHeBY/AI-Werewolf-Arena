/**
 * 配置读取集成测试以仓库外带空格的临时文件为输入，独立预期核对声明路径、PATH 命令和不透明参数边界。
 * 仅加载合成 ACP 配置，不启动适配器或模型，不写入工作区配置、录制和输出目录。
 */
import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadRuntimeConfig } from "@ai-werewolf-arena/game-runtime/app/config/load-config";

test("configuration file paths are relative to the declaring file, never to the process cwd", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa external config "));
  try {
    await mkdir(path.join(directory, "runtime"));
    await mkdir(path.join(directory, "games"));
    await writeFile(
      path.join(directory, "runtime", "backends.json"),
      JSON.stringify({
        schemaVersion: 2,
        items: {
          local: {
            kind: "acp",
            config: {
              transport: "stdio",
              command: "./tools/adapter",
              args: ["./opaque-server-argument"],
              cwd: "./workspace",
            },
          },
          from_path: { kind: "acp", config: { transport: "stdio", command: "codex-acp" } },
        },
      }),
    );
    await writeFile(
      path.join(directory, "runtime", "agents.json"),
      JSON.stringify({
        schemaVersion: 2,
        default: "local",
        items: { local: { backend: "local", options: {} } },
      }),
    );
    await writeFile(
      path.join(directory, "games", "local.json"),
      JSON.stringify({ agent: "local", recordRootDir: "../records" }),
    );
    const config = await loadRuntimeConfig({
      configDir: directory,
      gameName: "local",
      environment: {},
    });
    expect(config.providers.items.local).toMatchObject({
      command: path.join(directory, "runtime", "tools", "adapter"),
      cwd: path.join(directory, "runtime", "workspace"),
      args: ["./opaque-server-argument"],
    });
    expect(config.providers.items.from_path).toMatchObject({ command: "codex-acp" });
    expect(config.game.recordRootDir).toBe(path.join(directory, "records"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
