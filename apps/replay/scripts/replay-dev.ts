/**
 * 负责开发复盘入口的文件定位与 Vite 子进程装配。输入为文件／会话目录路径和显示语言参数，输出已解析路径或子进程退出码。
 * 文件存在性校验不等于归档内容校验；CLI 只把路径传给开发服务器，不改源文件或复制其内容到配置。
 */
import {
  applicationDirectory,
  applicationResource,
  resolveReplayInput,
} from "@ai-werewolf-arena/project-paths";
import { isLocale } from "@ai-werewolf-arena/game-contract";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { replayCommandFailure } from "@ai-werewolf-arena/game-media/cli-error";

/** 子进程仅消费已解析输入；工具目录与参数目录在此明确分开，退出时回收信号监听。 */
export async function startReplayDevServer(
  replayPath?: string,
  viteArguments: string[] = [],
): Promise<number> {
  const child = Bun.spawn(
    [
      process.execPath,
      applicationResource("replay", "node_modules/vite/bin/vite.js"),
      "--config",
      applicationResource("replay", "vite.config.ts"),
      ...viteArguments,
    ],
    {
      cwd: applicationDirectory("replay"),
      env: { ...process.env, AWA_REPLAY_INPUT: replayPath },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  const stop = () => child.kill("SIGTERM");
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    return await child.exited;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}

if (import.meta.main) {
  let locale: Locale = "zh-CN";
  try {
    const argv = process.argv.slice(2),
      args = argv[0] === "--" ? argv.slice(1) : argv;
    let input: string | undefined;
    for (let index = 0; index < args.length; index += 2) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("replay_dev_usage");
      if (args[index] === "--input") input = value;
      else if (args[index] === "--display-locale") {
        if (!isLocale(value)) throw new Error("replay_display_locale_invalid");
        locale = value;
      } else throw new Error("replay_dev_usage");
    }

    if (!input) throw new Error("replay_dev_usage");
    const replayPath = resolveReplayInput(input);
    process.exitCode = await startReplayDevServer(replayPath);
  } catch (error) {
    console.error(JSON.stringify(replayCommandFailure(error, locale)));
    process.exitCode = 1;
  }
}
