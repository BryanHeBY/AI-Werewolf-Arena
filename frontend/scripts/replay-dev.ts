/**
 * 负责开发复盘入口的文件定位与 Vite 子进程装配。输入为文件／会话目录路径和显示语言参数，输出已解析路径或子进程退出码。
 * 文件存在性校验不等于归档内容校验；CLI 只把路径传给开发服务器，不改源文件或复制其内容到配置。
 */
import { isLocale } from "@ai-werewolf-arena/game-catalog";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { replayCommandFailure } from "./cli_error";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

export function resolveReplayInput(input: string, cwd: string = process.cwd()): string {
  const resolved = path.resolve(cwd, input);
  if (!existsSync(resolved)) {
    throw new Error(`Replay input not found: ${resolved}`);
  }
  const replayPath = statSync(resolved).isDirectory()
    ? path.join(resolved, "replay.json")
    : resolved;
  if (!existsSync(replayPath) || !statSync(replayPath).isFile()) {
    throw new Error(`Replay file not found: ${replayPath}`);
  }
  return replayPath;
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
    // cwd 保持调用目录；复盘路径经独立环境字段传递，标准流与最终退出码直接接回本命令。
    const child = Bun.spawn(["bunx", "vite"], {
      cwd: process.cwd(),
      env: { ...process.env, AWA_REPLAY_INPUT: replayPath },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    process.exitCode = await child.exited;
  } catch (error) {
    console.error(JSON.stringify(replayCommandFailure(error, locale)));
    process.exitCode = 1;
  }
}
