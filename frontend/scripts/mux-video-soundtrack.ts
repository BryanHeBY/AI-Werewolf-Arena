/** 负责为已渲染视频替换混音。输入为画面成片和校验过的母带，输出原子发布的配乐版；直接复制画面码流，不重新渲染或编码画面。 */
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { publishVideoDirectory } from "./video/publication";
import { soundtrackCommand } from "./video/soundtrack";

export async function soundtrackFileHash(file: string) {
  const hash = createHash("sha256");
  const reader = Bun.file(file).stream().getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
    }
  } finally {
    reader.releaseLock();
  }
  return hash.digest("hex");
}
export async function muxVideoSoundtrack(options: {
  video: string;
  mix: string;
  directory: string;
}) {
  const video = path.resolve(options.video),
    mixFile = path.resolve(options.mix);
  const mix = JSON.parse(await readFile(mixFile, "utf8"));
  const publication = JSON.parse(
    await readFile(path.join(path.dirname(mixFile), "publication.json"), "utf8"),
  );
  if (publication.complete !== true || (await soundtrackFileHash(mix.master)) !== mix.sha256)
    throw new Error("soundtrack_mix_digest_mismatch");
  async function probe(file: string) {
    return JSON.parse(
      (
        await soundtrackCommand([
          "ffprobe",
          "-v",
          "error",
          "-show_entries",
          "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames:format=duration",
          "-of",
          "json",
          file,
        ])
      ).toString(),
    );
  }
  const source = await probe(video),
    sourceVideo = source.streams.find(
      (stream: { codec_type: string }) => stream.codec_type === "video",
    );
  const seconds = mix.durationFrames / mix.fps;
  if (
    !sourceVideo ||
    Number(sourceVideo.nb_frames) !== mix.durationFrames ||
    Math.abs(Number(source.format.duration) - seconds) > 1 / mix.fps
  )
    throw new Error("soundtrack_video_duration_mismatch");
  const sourceHash = await soundtrackFileHash(video),
    name = `music-${mix.sha256.slice(0, 12)}-${sourceHash.slice(0, 12)}`;
  const destination = path.resolve(options.directory, name);
  return publishVideoDirectory(options.directory, async (candidate) => {
    const file = path.join(candidate, "with-music-v1.mp4");
    await soundtrackCommand([
      "ffmpeg",
      "-v",
      "error",
      "-nostdin",
      "-threads",
      "1",
      "-i",
      video,
      "-i",
      mix.master,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-map_metadata",
      "0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-t",
      String(seconds),
      "-movflags",
      "+faststart",
      file,
    ]);
    const output = await probe(file),
      outputVideo = output.streams.find(
        (stream: { codec_type: string }) => stream.codec_type === "video",
      );
    if (
      JSON.stringify(outputVideo) !== JSON.stringify(sourceVideo) ||
      Math.abs(Number(output.format.duration) - seconds) > 1 / mix.fps
    )
      throw new Error("soundtrack_mux_duration_mismatch");
    const videoHash = async (input: string) =>
      (
        await soundtrackCommand([
          "ffmpeg",
          "-v",
          "error",
          "-nostdin",
          "-i",
          input,
          "-map",
          "0:v:0",
          "-c:v",
          "copy",
          "-f",
          "hash",
          "-hash",
          "sha256",
          "pipe:1",
        ])
      )
        .toString()
        .trim();
    const [before, after] = await Promise.all([videoHash(video), videoHash(file)]);
    if (before !== after) throw new Error("soundtrack_video_stream_changed");
    // 在多个位置比对编码后的音频，排除封装引入的时间偏移和意外替换。
    const checks = [];
    for (const from of [
      ...new Set(
        [1, seconds * 0.3, seconds * 0.65, Math.max(0, seconds - 5)].map((time) =>
          Math.floor(time),
        ),
      ),
    ]) {
      const decode = async (input: string) => {
        const bytes = await soundtrackCommand([
          "ffmpeg",
          "-v",
          "error",
          "-nostdin",
          "-threads",
          "1",
          "-ss",
          String(from),
          "-i",
          input,
          "-t",
          "1",
          "-vn",
          "-ac",
          "2",
          "-ar",
          "24000",
          "-f",
          "f32le",
          "pipe:1",
        ]);
        return new Float32Array(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        );
      };
      const [actual, expected] = await Promise.all([decode(file), decode(mix.master)]);
      let xy = 0,
        xx = 0,
        yy = 0;
      if (actual.length !== expected.length || !actual.length)
        throw new Error("soundtrack_mux_audio_samples_mismatch");
      for (let i = 0; i < actual.length; i++) {
        xy += actual[i]! * expected[i]!;
        xx += actual[i]! ** 2;
        yy += expected[i]! ** 2;
      }
      const correlation = xy / Math.sqrt(xx * yy);
      if (!Number.isFinite(correlation) || correlation < 0.97)
        throw new Error("soundtrack_mux_audio_alignment_failed");
      checks.push({ fromSeconds: from, correlation });
    }
    const result = {
      video: path.join(destination, path.basename(file)),
      source: video,
      sourceSha256: sourceHash,
      mix: mixFile,
      durationSeconds: seconds,
      durationFrames: mix.durationFrames,
      fps: mix.fps,
      videoStreamIdentical: true,
      videoStreamSha256: before,
      audioChecks: checks,
      sha256: await soundtrackFileHash(file),
    };
    await writeFile(path.join(candidate, "export.json"), JSON.stringify(result, null, 2) + "\n");
    await writeFile(
      path.join(candidate, "credits.txt"),
      await readFile(path.join(path.dirname(mixFile), "credits.txt")),
    );
    return { name, value: result };
  });
}
if (import.meta.main) {
  const { values } = parseArgs({
    options: { video: { type: "string" }, mix: { type: "string" }, output: { type: "string" } },
  });
  if (!values.video || !values.mix || !values.output)
    throw new Error("soundtrack_arguments_required");
  console.log(
    JSON.stringify(
      await muxVideoSoundtrack({ video: values.video, mix: values.mix, directory: values.output }),
    ),
  );
}
