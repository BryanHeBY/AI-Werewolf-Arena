import { promises as fs } from "fs";
import path from "path";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { resolveDefaultRecordRoot } from "../observability";

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
  if (
    !bundle || typeof bundle !== "object" ||
    (bundle as { perspective?: unknown }).perspective !== "god" ||
    typeof (bundle as { sessionId?: unknown }).sessionId !== "string" ||
    !Array.isArray((bundle as { events?: unknown }).events)
  ) {
    throw new Error(`replay_bundle_invalid: ${filePath}`);
  }
  return bundle as ReplayDocument;
}

export async function exportReplayBundle(options: {
  recordRoot: string;
  sessionId: string;
  outputFile: string;
}): Promise<ReplayDocument> {
  const bundle = await readReplayBundle(options.recordRoot, options.sessionId);
  await fs.mkdir(path.dirname(options.outputFile), { recursive: true });
  await fs.writeFile(options.outputFile, `${JSON.stringify(bundle, null, 2)}\n`, "utf-8");
  return bundle;
}

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const sessionId = readFlag(args, "--session");
  const recordRoot = readFlag(args, "--record-root") ?? resolveDefaultRecordRoot();
  const outputFile = readFlag(args, "--out");
  if (!sessionId || !outputFile) {
    throw new Error(
      "Usage: bun src/replay/export_replay_bundle.ts --session <session_id> --out <file> [--record-root <dir>]",
    );
  }
  const bundle = await exportReplayBundle({ recordRoot, sessionId, outputFile });
  console.log(`Exported ${bundle.events.length} events to ${outputFile}`);
}

if (require.main === module) {
  void runCli();
}
