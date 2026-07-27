import { promises as fs } from "fs";
import path from "path";
import { resolveDefaultRecordRoot } from "../observability";
import { ReplayRecordRepository } from "../server/replay_record_repository";
import {
  ReplaySourceDocument,
  createReplaySourceDocument,
} from "../server/replay_source_document";

export async function readReplayBundle(
  recordRoot: string,
  sessionId: string,
): Promise<ReplaySourceDocument> {
  const repository = new ReplayRecordRepository(recordRoot);
  const [manifest, timeline, phaseWindows] = await Promise.all([
    repository.getManifest(sessionId),
    repository.getPublicTimeline(sessionId, {}),
    repository.getPhaseWindows(sessionId),
  ]);
  return createReplaySourceDocument({
    manifest,
    events: timeline.events,
    phaseWindows: phaseWindows.windows,
  });
}

export async function exportReplayBundle(options: {
  recordRoot: string;
  sessionId: string;
  outputFile: string;
}): Promise<ReplaySourceDocument> {
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
  // eslint-disable-next-line no-console
  console.log(`Exported ${bundle.events.length} events to ${outputFile}`);
}

if (require.main === module) {
  void runCli();
}
