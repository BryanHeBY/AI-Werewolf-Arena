import { existsSync } from "node:fs";
import path from "node:path";

function readInput(args: string[]): string | undefined {
  const index = args.indexOf("--input");
  return index >= 0 ? args[index + 1] : undefined;
}

const input = readInput(process.argv.slice(2));
if (!input) {
  throw new Error("Usage: bun run replay:dev -- --input /absolute/path/to/game.replay.json");
}

const replayPath = path.resolve(process.cwd(), input);
if (!existsSync(replayPath)) {
  throw new Error(`Replay file not found: ${replayPath}`);
}

const child = Bun.spawn(["bunx", "vite"], {
  cwd: process.cwd(),
  env: { ...process.env, AWA_REPLAY_INPUT: replayPath },
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const exitCode = await child.exited;
process.exit(exitCode);
