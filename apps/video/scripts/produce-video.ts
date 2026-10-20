/** 统一制作命令负责串接本地编译、可恢复渲染、配乐和审片。输入为单局production.ts，输出output中的版本与索引；不隐式请求TTS。 */
import path from "node:path";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { compileSpeechVideo } from "./compile-speech-video";
import { renderProductionVideo } from "./render-production-video";
import { mixVideoSoundtrack, type VideoSoundtrack } from "./video/soundtrack";
import { muxVideoSoundtrack } from "./mux-video-soundtrack";
import { writeVideoReview, type ProductionBuild } from "./video/review";
import type { VideoProduction } from "./video/production";

export async function produceVideo(options: {
  production: string;
  stage: string;
  build?: string;
  video?: string;
  audio?: string;
  output?: string;
  workers?: number;
  browser?: string;
}) {
  if (!["compile", "render", "mix", "mux", "review", "all"].includes(options.stage))
    throw new Error("video_production_stage_invalid");
  const production = (await import(pathToFileURL(path.resolve(options.production)).href))
    .default as VideoProduction;
  const output = options.output ? path.resolve(options.output) : production.output;
  await mkdir(output, { recursive: true });
  const publishIndex = async (name: string, value: unknown) => {
    const file = path.join(output, name),
      temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(value, null, 2) + "\n");
    await rename(temporary, file);
  };
  const buildFile = options.build
    ? path.resolve(options.build)
    : path.join(output, "compiled-build.json");
  let build: ProductionBuild | undefined;
  const loadBuild = async () => (build ??= (await Bun.file(buildFile).json()) as ProductionBuild);
  const video = options.video ? path.resolve(options.video) : path.join(output, "movie.mp4");
  const stages =
    options.stage === "all"
      ? ["compile", "render", ...(production.soundtrack ? ["mix", "mux"] : []), "review"]
      : [options.stage];
  let result: unknown;
  for (const stage of stages) {
    if (stage === "compile") {
      build = await compileSpeechVideo({
        project: production.visual,
        script: production.script,
        casting: production.casting,
        manifest: production.manifest,
        directory: output,
        requireSubtitles: true,
      });
      result = build;
      await publishIndex("compiled-build.json", build);
    } else if (stage === "render") {
      await renderProductionVideo({
        project: (await loadBuild()).output,
        output: video,
        workers: options.workers ?? 6,
        browser: options.browser,
      });
      result = { video };
    } else if (stage === "mix") {
      if (!production.soundtrack) throw new Error("video_production_soundtrack_required");
      const soundtrack = (await import(pathToFileURL(production.soundtrack).href))
        .default as VideoSoundtrack;
      const mix = await mixVideoSoundtrack({
        timeline: path.join(path.dirname((await loadBuild()).output), "speech-timeline.json"),
        soundtrack,
        directory: path.join(output, "audio-versions"),
      });
      result = { mix: path.join(mix.directory, "mix-report.json"), audio: mix.master };
      await publishIndex("mixed-build.json", result);
    } else if (stage === "mux") {
      const mix = (await Bun.file(path.join(output, "mixed-build.json")).json()) as { mix: string };
      result = await muxVideoSoundtrack({
        video,
        mix: mix.mix,
        directory: path.join(output, "music-versions"),
      });
      await publishIndex("delivery.json", result);
    } else {
      const delivery = Bun.file(path.join(output, "delivery.json"));
      const final =
        !options.video && (await delivery.exists())
          ? ((await delivery.json()) as { video: string; mix: string })
          : undefined;
      const audio = options.audio
        ? path.resolve(options.audio)
        : final
          ? ((await Bun.file(final.mix).json()) as { master: string }).master
          : undefined;
      result = await writeVideoReview({
        title: production.title,
        model: production.model,
        script: production.script,
        build: await loadBuild(),
        video: final?.video ?? video,
        audio,
        directory: path.join(output, "review"),
      });
    }
  }
  return result;
}
if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      production: { type: "string" },
      stage: { type: "string" },
      build: { type: "string" },
      video: { type: "string" },
      audio: { type: "string" },
      output: { type: "string" },
      workers: { type: "string" },
      browser: { type: "string" },
    },
  });
  if (!values.production || !values.stage) throw new Error("video_production_arguments_required");
  console.log(
    JSON.stringify(
      await produceVideo({
        production: values.production,
        stage: values.stage,
        build: values.build,
        video: values.video,
        audio: values.audio,
        output: values.output,
        workers: values.workers ? Number(values.workers) : undefined,
        browser: values.browser,
      }),
    ),
  );
}
