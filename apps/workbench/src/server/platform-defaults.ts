/**
 * 负责本机平台向导的非认证缺省值；输入项目和配置根，输出路径提示及工具存在性。
 * 只检查工具位置，不读取凭据内容或启动进程。
 * Claude Code 使用已审查的空文件系统 bwrap 模板，依赖只读挂载，玩家工作区由运行时逐局提供。
 */
import path from "node:path";
import os from "node:os";
import { constants, promises as fs } from "node:fs";

async function accessible(file: string, mode: number): Promise<boolean> {
  try {
    await fs.access(file, mode);
    return true;
  } catch {
    return false;
  }
}

export async function describePlatformDefaults(repository: string, configs: string) {
  const command = path.join(repository, "configs.example/acp/run-bwrap-acp.sh");
  const runtimeRoot = path.join(configs, "acp/node_modules");
  const adapter = path.join(runtimeRoot, ".bin/claude-agent-acp");
  const packages = [
    "game-runtime",
    "game-contract",
    "game-catalog",
    "game-text",
    "game-presentation",
    "replay-contract",
    "workbench-contract",
    "project-paths",
  ];
  return {
    claudeCode: {
      supported: process.platform === "linux",
      command,
      args: [adapter],
      authSource: path.join(os.homedir(), ".claude/.credentials.json"),
      env: {
        ACP_AUTH_KIND: "claude",
        ACP_RUNTIME_ROOT: runtimeRoot,
        ACP_READONLY_ROOTS: [
          ...packages.map((name) => path.join(repository, "packages", name)),
          path.join(repository, "node_modules"),
        ].join(":"),
      },
      available: {
        launcher: await accessible(command, constants.X_OK),
        adapter: await accessible(adapter, constants.X_OK),
        bwrap: await accessible("/usr/bin/bwrap", constants.X_OK),
      },
    },
  };
}
