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
    const argv = process.argv.slice(2), args = argv[0] === "--" ? argv.slice(1) : argv;
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
    const child = Bun.spawn(["bunx", "vite"], {
      cwd: process.cwd(), env: { ...process.env, AWA_REPLAY_INPUT: replayPath },
      stdin: "inherit", stdout: "inherit", stderr: "inherit",
    });
    process.exitCode = await child.exited;
  } catch (error) { console.error(JSON.stringify(replayCommandFailure(error, locale))); process.exitCode = 1; }
}
