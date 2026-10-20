/** 负责按许可来源与摘要准备本机音源。输入为来源清单，输出校验后的原件、处理片段与素材索引；check只读本地，二进制素材不进入Git。 */
import path from "node:path";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { parseArgs } from "node:util";
import { soundtrackCommand } from "./video/soundtrack";

interface AudioSource {
  id: string;
  file: string;
  sha256: string;
  downloadUrl: string;
  originalFile?: string;
  originalSha256?: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  prepare?: {
    startSeconds: number;
    durationSeconds: number;
    filter: string;
    sampleRate: number;
    channels: number;
  };
}
export async function prepareVideoAudio(options: {
  sources: string;
  directory: string;
  check?: boolean;
}) {
  const catalog = JSON.parse(await readFile(path.resolve(options.sources), "utf8")) as {
    assets: AudioSource[];
  };
  const directory = path.resolve(options.directory),
    ids = new Set<string>();
  const target = (file: string) => {
    const resolved = path.resolve(directory, file);
    if (!resolved.startsWith(directory + path.sep))
      throw new Error("video_audio_path_outside_library");
    return resolved;
  };
  const valid = async (file: string, sha256: string) => {
    try {
      if (
        createHash("sha256")
          .update(await readFile(file))
          .digest("hex") !== sha256
      )
        throw new Error("video_audio_digest_mismatch");
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  };
  for (const asset of catalog.assets) {
    if (
      ids.has(asset.id) ||
      !asset.license ||
      !asset.licenseUrl ||
      !asset.sourceUrl ||
      !/^https:\/\//.test(asset.downloadUrl)
    )
      throw new Error("video_audio_source_invalid");
    ids.add(asset.id);
    const file = target(asset.file);
    if (await valid(file, asset.sha256)) continue;
    if (options.check) throw new Error(`video_audio_not_prepared:${asset.id}`);
    const original = asset.originalFile ? target(asset.originalFile) : file;
    const digest = asset.originalSha256 ?? asset.sha256;
    if (!(await valid(original, digest))) {
      const response = await fetch(asset.downloadUrl, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`video_audio_download_failed:${asset.id}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (createHash("sha256").update(bytes).digest("hex") !== digest)
        throw new Error(`video_audio_download_digest_mismatch:${asset.id}`);
      await mkdir(path.dirname(original), { recursive: true });
      const temporary = `${original}.${process.pid}.tmp`;
      await writeFile(temporary, bytes);
      await rename(temporary, original);
    }
    if (asset.prepare) {
      const temporary = `${file}.${process.pid}.tmp.wav`,
        settings = asset.prepare;
      await mkdir(path.dirname(file), { recursive: true });
      try {
        await soundtrackCommand([
          "ffmpeg",
          "-v",
          "error",
          "-nostdin",
          "-threads",
          "1",
          "-ss",
          String(settings.startSeconds),
          "-i",
          original,
          "-t",
          String(settings.durationSeconds),
          "-af",
          settings.filter,
          "-ar",
          String(settings.sampleRate),
          "-ac",
          String(settings.channels),
          "-c:a",
          "pcm_s16le",
          temporary,
        ]);
        if (!(await valid(temporary, asset.sha256)))
          throw new Error("video_audio_preparation_missing");
        await rename(temporary, file);
      } finally {
        await rm(temporary, { force: true });
      }
    }
  }
  if (!options.check) {
    await mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `manifest.${process.pid}.tmp`);
    await writeFile(temporary, JSON.stringify(catalog, null, 2) + "\n");
    await rename(temporary, path.join(directory, "manifest.json"));
  }
  return { assets: ids.size, checked: true, manifest: path.join(directory, "manifest.json") };
}
if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      sources: { type: "string" },
      output: { type: "string" },
      check: { type: "boolean" },
    },
  });
  if (!values.sources || !values.output) throw new Error("video_audio_arguments_required");
  console.log(
    JSON.stringify(
      await prepareVideoAudio({
        sources: values.sources,
        directory: values.output,
        check: values.check,
      }),
    ),
  );
}
