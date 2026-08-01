import { existsSync, statSync } from "node:fs";
import path from "node:path";

function readInput(args: string[]): string | undefined {
  const index = args.indexOf("--input");
  return index >= 0 ? args[index + 1] : undefined;
}

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
  const input = readInput(process.argv.slice(2));
  if (!input) {
    throw new Error(
      "Usage: bun run replay:dev -- --input /path/to/record/session_* (or /path/to/replay.json)",
    );
  }

  const replayPath = resolveReplayInput(input);
  const child = Bun.spawn(["bunx", "vite"], {
    cwd: process.cwd(),
    env: { ...process.env, AWA_REPLAY_INPUT: replayPath },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await child.exited;
  process.exit(exitCode);
}
