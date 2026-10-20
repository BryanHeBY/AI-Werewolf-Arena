/**
 * 负责长片的可恢复分段渲染与连续音轨封装。输入为实际配音编译的项目与输出位置，输出完整1080p视频和检查记录。
 * 分段只渲染画面，最终一次编码整条人声，避免逐段AAC拼接间隙；正式素材和进度均保存在本目录。
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, lstat, link, rename, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { prepareVideo, materializeVideo } from "./prepare-video";
import {
  renderVideoArtifact,
  defaultVideoRendering,
  writeVideoEntry,
} from "./render-video-artifact";

export async function renderProductionVideo(options: {
  project: string;
  output: string;
  workers?: number;
  browser?: string;
}) {
  const project = path.resolve(options.project);
  const output = path.resolve(options.output);
  const directory = path.dirname(output);
  const workersCount = options.workers ?? 6;
  if (
    !Number.isSafeInteger(workersCount) ||
    workersCount < 1 ||
    workersCount > 16 ||
    path.extname(output) !== ".mp4"
  )
    throw new Error("production_options_invalid");
  await mkdir(directory, { recursive: true });
  const prepared = await prepareVideo({ project });
  const { plan } = prepared;
  const timeline = JSON.parse(
    await readFile(path.join(path.dirname(project), "speech-timeline.json"), "utf8"),
  );
  if (
    timeline.timing !== "audio" ||
    timeline.durationFrames !== plan.durationFrames ||
    plan.audio.length !== 1 ||
    plan.audio[0]!.from !== 0 ||
    plan.audio[0]!.durationFrames !== plan.durationFrames
  )
    throw new Error("production_timeline_invalid");
  const master = timeline.audio.file as string;
  if (
    createHash("sha256")
      .update(await readFile(master))
      .digest("hex") !== timeline.audio.sha256
  )
    throw new Error("production_audio_digest_mismatch");
  async function runtimeHash() {
    const root = path.resolve(import.meta.dir, "../src");
    const files = (await readdir(root, { recursive: true }))
      .filter((file) => /\.tsx?$/.test(file))
      .sort();
    const hash = createHash("sha256");
    for (const file of files) hash.update(file).update(await readFile(path.join(root, file)));
    return hash.digest("hex");
  }
  const signature = createHash("sha256").update(JSON.stringify(plan)).digest("hex");
  const partsDirectory = path.join(directory, "parts");
  await mkdir(partsDirectory, { recursive: true });
  const jobFile = path.join(partsDirectory, "job.json");
  const job = {
    signature,
    project: path.resolve(project),
    durationFrames: plan.durationFrames,
    fps: plan.fps,
    partFrames: plan.fps * 60,
    runtimeHash: await runtimeHash(),
  };
  try {
    await writeFile(jobFile, JSON.stringify(job, null, 2) + "\n", { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const previous = JSON.parse(await readFile(jobFile, "utf8"));
    if (JSON.stringify({ ...previous, runtimeHash: job.runtimeHash }) !== JSON.stringify(job))
      throw new Error("production_resume_project_mismatch");
    // 已保存分段继续使用本版本冻结的运行时；画面代码更新应导出到新目录，不能混入恢复任务。
    if (
      previous.runtimeHash !== job.runtimeHash &&
      !(await Bun.file(path.join(directory, "render-assets/bundle/index.html")).exists())
    )
      throw new Error("production_resume_runtime_missing");
    job.runtimeHash = previous.runtimeHash;
  }
  async function command(args: string[]) {
    const child = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code) throw new Error(`${args[0]} exited ${code}: ${stderr}`);
    return stdout;
  }
  interface ProbedStream {
    codec_type: string;
    codec_name: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    nb_frames?: string;
  }
  interface Probe {
    streams: ProbedStream[];
    format: { duration: string; size: string };
  }
  async function inspect(file: string): Promise<Probe> {
    return JSON.parse(
      await command([
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames:format=duration,size",
        "-of",
        "json",
        file,
      ]),
    );
  }
  const parts = Array.from(
    { length: Math.ceil(plan.durationFrames / job.partFrames) },
    (_, index) => {
      const from = index * job.partFrames;
      const to = Math.min(plan.durationFrames, from + job.partFrames) - 1;
      return {
        index,
        from,
        to,
        file: path.join(partsDirectory, `part-${String(index).padStart(3, "0")}.mp4`),
      };
    },
  );
  const completed = new Map<number, number>();
  const progress = new Map<number, number>();
  const started = Date.now();
  let statusSequence = 0;
  async function saveStatus(stage: string, extra: object = {}) {
    const renderedFrames = [...progress.values()].reduce((a, b) => a + b, 0);
    const status = {
      stage,
      signature,
      runtimeHash: job.runtimeHash,
      subtitleCount: plan.subtitles?.length ?? 0,
      durationLimitRemoved: true,
      project: job.project,
      video: output,
      durationSeconds: plan.durationFrames / plan.fps,
      completedParts: completed.size,
      parts: parts.length,
      renderedFrames,
      totalFrames: plan.durationFrames,
      updatedAt: new Date().toISOString(),
      elapsedSeconds: Math.round((Date.now() - started) / 1000),
      ...extra,
    };
    const statusFile = path.join(directory, "production-status.json");
    const temporaryStatus = `${statusFile}.${process.pid}.${statusSequence++}.tmp`;
    await writeFile(temporaryStatus, JSON.stringify(status, null, 2) + "\n");
    await rename(temporaryStatus, statusFile);
    console.log(JSON.stringify(status));
  }
  // 保留字幕、事件与镜头时间，只让最终封装独占音轨，浏览器不重复加载整条WAV。
  const silent = { ...prepared, plan: { ...plan, audio: [] } };
  const resources = path.join(directory, "render-assets");
  const publicDir = path.join(resources, "public");
  await mkdir(publicDir, { recursive: true });
  await materializeVideo(silent, publicDir);
  const entryPoint = await writeVideoEntry(silent, resources);
  const bundleDirectory = path.join(resources, "bundle");
  const serveUrl = (await Bun.file(path.join(bundleDirectory, "index.html")).exists())
    ? bundleDirectory
    : await defaultVideoRendering.bundle({ entryPoint, publicDir, outDir: bundleDirectory });
  const rendering = { ...defaultVideoRendering, bundle: async () => serveUrl };
  let next = 0;
  let stopped = false;
  await saveStatus("rendering");
  async function worker() {
    while (!stopped && next < parts.length) {
      const part = parts[next++]!;
      let existing = false;
      try {
        await lstat(part.file);
        existing = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (!existing) {
        let last = 0;
        await renderVideoArtifact(
          silent,
          {
            output: part.file,
            fromFrame: part.from,
            toFrame: part.to,
            browser: options.browser ?? "/usr/bin/chromium",
            concurrency: 1,
            timeoutMs: 120000,
            onProgress: ({ renderedFrames }) => {
              progress.set(part.index, renderedFrames);
              if (Date.now() - last > 20000) {
                last = Date.now();
                console.log(
                  JSON.stringify({
                    part: part.index,
                    renderedFrames,
                    expectedFrames: part.to - part.from + 1,
                  }),
                );
              }
            },
          },
          rendering,
        );
      }
      const metadata = await inspect(part.file);
      const video = metadata.streams.find((stream) => stream.codec_type === "video");
      if (
        metadata.streams.length !== 1 ||
        video?.codec_name !== "h264" ||
        video?.width !== plan.width ||
        video.height !== plan.height ||
        video.r_frame_rate !== `${plan.fps}/1` ||
        Number(video.nb_frames) !== part.to - part.from + 1
      )
        throw new Error(`production_part_invalid:${part.index}`);
      completed.set(part.index, part.to - part.from + 1);
      progress.set(part.index, part.to - part.from + 1);
      await saveStatus("rendering");
    }
  }
  try {
    const workers = await Promise.allSettled(
      Array.from({ length: workersCount }, () =>
        worker().catch((error) => {
          stopped = true;
          throw error;
        }),
      ),
    );
    const failure = workers.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
    await saveStatus("muxing");
    const list = path.join(partsDirectory, "concat.txt");
    await writeFile(
      list,
      parts.map((part) => `file '${part.file.replaceAll("'", "'\\''")}'`).join("\n") + "\n",
    );
    const temporary = `${output}.pending.mp4`;
    await command([
      "ffmpeg",
      "-hide_banner",
      "-loglevel",
      "error",
      "-n",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-i",
      master,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-ar",
      "48000",
      "-t",
      String(plan.durationFrames / plan.fps),
      "-movflags",
      "+faststart",
      "-metadata",
      `title=${plan.program?.title ?? "AI 狼人杀"}`,
      temporary,
    ]);
    const metadata = await inspect(temporary);
    const video = metadata.streams.find((stream) => stream.codec_type === "video");
    const audio = metadata.streams.find((stream) => stream.codec_type === "audio");
    if (
      Number(video?.nb_frames) !== plan.durationFrames ||
      !audio ||
      Math.abs(Number(metadata.format.duration) - plan.durationFrames / plan.fps) > 1 / plan.fps
    )
      throw new Error("production_final_invalid");
    await link(temporary, output);
    await rm(temporary);
    await writeFile(
      path.join(directory, "video-check.json"),
      JSON.stringify(metadata, null, 2) + "\n",
    );
    await saveStatus("complete", { bytes: Number(metadata.format.size), audio: master });
  } catch (error) {
    await saveStatus("failed", { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
if (import.meta.main) {
  const { parseArgs } = await import("node:util");
  const { values } = parseArgs({
    args: process.argv.slice(2),
    strict: true,
    options: {
      project: { type: "string" },
      output: { type: "string" },
      workers: { type: "string" },
      browser: { type: "string" },
    },
  });
  if (!values.project || !values.output) throw new Error("production_arguments_required");
  await renderProductionVideo({
    project: values.project,
    output: values.output,
    workers: values.workers ? Number(values.workers) : undefined,
    browser: values.browser,
  });
}
