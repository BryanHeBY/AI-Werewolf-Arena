/**
 * 负责公开复盘文件的实际读取与导出；输入为会话目录、历史裸档或显式新封装，输出为规范 document 和导出文件。
 * 新封装的来源声明原样保留；旧档继续输出原 schema 2 转换，不补造语义或构建身份。
 * 同路径和文件系统别名拒绝仍在写入前，I/O／JSON／数据失败按原边界传播；不授予严格复现兼容。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { runCli, takeDisplayArguments, type CliDisplayContext } from "./display";
import { promises as fs } from "fs";
import path from "path";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { readReplayArchive, createRecordingEnvelope } from "@ai-werewolf-arena/replay-contract";
import { resolveDefaultRecordRoot } from "../../recording/session/recorder";

async function readReplayBundleArchive(
  recordRoot: string,
  sessionId: string,
) {
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
    return readReplayArchive(bundle);
  } catch (error) {
    throw new Error(`replay_bundle_invalid: ${filePath} -> ${(error as Error).message}`);
  }
}

/** 旧数据 API 返回原规范 document；实际导出还保留新封装声明，不伪装历史裸档。 */
export async function readReplayBundle(recordRoot: string, sessionId: string): Promise<ReplayDocument> {
  return (await readReplayBundleArchive(recordRoot, sessionId)).replay;
}

export async function exportReplayBundle(options: {
  recordRoot: string;
  sessionId: string;
  outputFile: string;
}): Promise<ReplayDocument> {
  const source = path.resolve(path.join(options.recordRoot, options.sessionId, "replay.json"));
  const destination = path.resolve(options.outputFile);
  if (source === destination) throw new Error("replay_export_overwrites_source");
  const archive = await readReplayBundleArchive(options.recordRoot, options.sessionId);
  const bundle = archive.replay;
  const sourceInfo = await fs.stat(source);
  const destinationInfo = await fs.stat(destination).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  });
  if (destinationInfo?.dev === sourceInfo.dev && destinationInfo.ino === sourceInfo.ino)
    throw new Error("replay_export_overwrites_source");
  await fs.mkdir(path.dirname(options.outputFile), { recursive: true });
  await fs.writeFile(options.outputFile, `${JSON.stringify(archive.identities ? createRecordingEnvelope("public_replay", bundle, archive.identities) : bundle, null, 2)}\n`, "utf-8");
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
  console.log(
    text(display.locale, "cli.exported", { count: bundle.events.length, file: outputFile }),
  );
}

if (require.main === module) {
  void runCli(main);
}
