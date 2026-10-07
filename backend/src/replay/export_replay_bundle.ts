import { text } from "@ai-werewolf-arena/game-text";
import { runCli, takeDisplayArguments, type CliDisplayContext } from "../runtime/cli/display";
import { promises as fs } from "fs";
import path from "path";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { resolveDefaultRecordRoot } from "../recording/session_recorder";

export async function readReplayBundle(
  recordRoot: string,
  sessionId: string,
): Promise<ReplayDocument> {
  const filePath = path.join(recordRoot, sessionId, "replay.json");
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (error) {
    throw new Error(`replay_bundle_file_unreadable: ${filePath} -> ${(error as Error).message}`);
  }
  let bundle: unknown;
  try {
    bundle = JSON.parse(raw);
  } catch (error) {
    throw new Error(`replay_bundle_json_invalid: ${filePath} -> ${(error as Error).message}`);
  }
  try {
    return readReplayDocument(bundle);
  } catch (error) {
    throw new Error(`replay_bundle_invalid: ${filePath} -> ${(error as Error).message}`);
  }
}

export async function exportReplayBundle(options: {
  recordRoot: string;
  sessionId: string;
  outputFile: string;
}): Promise<ReplayDocument> {
  const source = path.resolve(path.join(options.recordRoot, options.sessionId, "replay.json"));
  const destination = path.resolve(options.outputFile);
  if (source === destination) throw new Error("replay_export_overwrites_source");
  const bundle = await readReplayBundle(options.recordRoot, options.sessionId);
  const sourceInfo = await fs.stat(source);
  const destinationInfo = await fs.stat(destination).catch(error => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  });
  if (destinationInfo?.dev === sourceInfo.dev && destinationInfo.ino === sourceInfo.ino) throw new Error("replay_export_overwrites_source");
  await fs.mkdir(path.dirname(options.outputFile), { recursive: true });
  await fs.writeFile(options.outputFile, `${JSON.stringify(bundle, null, 2)}\n`, "utf-8");
  return bundle;
}

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(argv: string[], display: CliDisplayContext): Promise<void> {
  const args = takeDisplayArguments(argv, display);
  const sessionId = readFlag(args, "--session");
  const recordRoot = readFlag(args, "--record-root") ?? resolveDefaultRecordRoot();
  const outputFile = readFlag(args, "--out");
  if (!sessionId || !outputFile) {
    throw new Error("replay_export_usage");
  }
  const bundle = await exportReplayBundle({ recordRoot, sessionId, outputFile });
  if (!display.explicit) display.locale = bundle.meta.locale ?? "zh-CN";
  console.log(text(display.locale, "cli.exported", { count: bundle.events.length, file: outputFile }));
}

if (require.main === module) {
  void runCli(main);
}
