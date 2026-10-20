/** 本地成片验收核对编码、帧数、音频对齐和结束留白。输入为MP4及连续母带，输出可保存报告；不依赖某一局或重新渲染。 */
import path from "node:path";
import { parseArgs } from "node:util";
import { soundtrackCommand } from "./video/soundtrack";
import { soundtrackFileHash } from "./mux-video-soundtrack";

export async function verifyVideoArtifact(options: {
  video: string;
  audio: string;
  fps: number;
  frames: number;
  width: number;
  height: number;
  endingSilenceMs?: number;
}) {
  if (
    [options.fps, options.frames, options.width, options.height].some(
      (value) => !Number.isSafeInteger(value) || value <= 0,
    ) ||
    !Number.isFinite(options.endingSilenceMs ?? 400) ||
    (options.endingSilenceMs ?? 400) < 0
  )
    throw new Error("video_artifact_options_invalid");
  const videoFile = path.resolve(options.video),
    audioFile = path.resolve(options.audio);
  const probe = JSON.parse(
    (
      await soundtrackCommand([
        "ffprobe",
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        videoFile,
      ])
    ).toString(),
  );
  const video = probe.streams.find(
    (stream: { codec_type: string }) => stream.codec_type === "video",
  );
  const audio = probe.streams.find(
    (stream: { codec_type: string }) => stream.codec_type === "audio",
  );
  const seconds = options.frames / options.fps;
  if (
    !video ||
    video.codec_name !== "h264" ||
    audio?.codec_name !== "aac" ||
    video.width !== options.width ||
    video.height !== options.height ||
    video.r_frame_rate !== `${options.fps}/1` ||
    Number(video.nb_frames) !== options.frames ||
    Math.abs(Number(probe.format.duration) - seconds) > 1 / options.fps
  )
    throw new Error("video_artifact_metadata_mismatch");
  const decode = async (file: string, from: number, duration: number) => {
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
      file,
      "-t",
      String(duration),
      "-vn",
      "-ac",
      "1",
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
  const checks = [];
  for (const from of [
    ...new Set(
      [1, seconds * 0.53, Math.max(0, seconds - 8)].map((value) =>
        Math.min(Math.floor(value), Math.max(0, seconds - 1)),
      ),
    ),
  ]) {
    const [actual, expected] = await Promise.all([
      decode(videoFile, from, 1),
      decode(audioFile, from, 1),
    ]);
    let score = -1,
      lag = 0;
    for (let shift = -240; shift <= 240; shift++) {
      const a = Math.max(0, shift),
        b = Math.max(0, -shift),
        count = Math.min(actual.length - a, expected.length - b);
      let xy = 0,
        xx = 0,
        yy = 0;
      for (let i = 0; i < count; i++) {
        const x = actual[a + i]!,
          y = expected[b + i]!;
        xy += x * y;
        xx += x * x;
        yy += y * y;
      }
      const correlation = xy / Math.sqrt(xx * yy);
      if (correlation > score) {
        score = correlation;
        lag = shift;
      }
    }
    if (score < 0.97 || Math.abs(lag) > 48)
      throw new Error("video_artifact_audio_alignment_failed");
    checks.push({ seconds: from, correlation: score, lagMs: lag / 24 });
  }
  const silence = (options.endingSilenceMs ?? 400) / 1000;
  let tailPeakDb: number | null = null;
  if (silence > 0) {
    const tail = await decode(videoFile, Math.max(0, seconds - silence / 2), silence / 3);
    let peak = 0;
    for (const value of tail) peak = Math.max(peak, Math.abs(value));
    tailPeakDb = 20 * Math.log10(Math.max(1e-12, peak));
    if (!tail.length || tailPeakDb > -60) throw new Error("video_artifact_tail_not_silent");
  }
  return {
    passed: true,
    video: videoFile,
    sha256: await soundtrackFileHash(videoFile),
    frames: options.frames,
    seconds,
    audioSync: checks,
    tailPeakDb,
  };
}
if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      review: { type: "string" },
      output: { type: "string" },
      "ending-silence-ms": { type: "string" },
    },
  });
  if (!values.review) throw new Error("video_review_required");
  const review = await Bun.file(path.resolve(values.review)).json();
  const result = await verifyVideoArtifact({
    video: review.video,
    audio: review.audio,
    fps: review.fps,
    frames: Math.round(review.seconds * review.fps),
    width: review.width,
    height: review.height,
    endingSilenceMs: values["ending-silence-ms"] ? Number(values["ending-silence-ms"]) : undefined,
  });
  if (values.output)
    await Bun.write(path.resolve(values.output), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
}
