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

    const replayPath = input ? resolveReplayInput(input) : undefined;
    // 输入先相对调用目录解析；Vite 工具固定在应用目录运行，不能重新解释数据路径。
    const child = Bun.spawn(
      [
        process.execPath,
        applicationResource("replay", "node_modules/vite/bin/vite.js"),
        "--config",
        applicationResource("replay", "vite.config.ts"),
      ],
      {
        cwd: applicationDirectory("replay"),
        env: { ...process.env, AWA_REPLAY_INPUT: replayPath },
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      },
    );
    process.exitCode = await child.exited;
  } catch (error) {
    console.error(JSON.stringify(replayCommandFailure(error, locale)));
    process.exitCode = 1;
  }
}
