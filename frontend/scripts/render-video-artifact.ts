/**
 * 负责视频产物的打包、浏览器和独占发布生命周期。输入为已准备计划、输出范围与渲染依赖，输出 PNG/MP4 或原失败集合。
 * 临时目录由本次调用拥有；源文件和已有目标保持只读，清理与渲染错误按发生顺序保留，不调用 TTS。
 */
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { mkdtemp, mkdir, rm, lstat, link, writeFile } from "node:fs/promises";
import path from "node:path";
import { materializeVideo, type PreparedVideo } from "./prepare-video";

export const defaultVideoRendering = {
  bundle,
  openBrowser,
  selectComposition,
  renderStill,
  renderMedia,
};
export type VideoRendering = typeof defaultVideoRendering;
export interface VideoArtifactOptions {
  output: string;
  frame?: number;
  fromFrame?: number;
  toFrame?: number;
  browser?: string;
  concurrency?: number;
  timeoutMs?: number;
  onProgress?: Parameters<typeof renderMedia>[0]["onProgress"];
}

/** 本入口只写本次独占的生成模块；自定义组件通过静态 import 进入 bundle，plan 保持可序列化。 */
export async function writeVideoEntry(prepared: PreparedVideo, directory: string): Promise<string> {
  const entry = path.join(directory, "entry.tsx");
  const root = path.resolve(import.meta.dir, "../src/video-root.tsx");
  const remotion = path.resolve(import.meta.dir, "../node_modules/remotion");
  const custom =
    prepared.projectPath && (prepared.layerNames.length || prepared.themeSlotNames?.length)
      ? `import * as authored from ${JSON.stringify(prepared.visualsPath ?? prepared.projectPath)};\nregisterRoot(createVideoRoot(authored.layers, authored.themeSlots));\n`
      : "registerRoot(createVideoRoot());\n";
  await writeFile(
    entry,
    `import {registerRoot} from ${JSON.stringify(remotion)};\nimport {createVideoRoot} from ${JSON.stringify(root)};\n${custom}`,
  );
  return entry;
}

export async function renderVideoArtifact(
  prepared: PreparedVideo,
  options: VideoArtifactOptions,
  rendering: VideoRendering = defaultVideoRendering,
): Promise<void> {
  const output = path.resolve(options.output);
  if (
    [
      prepared.sourcePath,
      prepared.projectPath,
      prepared.visualsPath,
      ...prepared.assets.map((asset) => asset.source),
    ].some((source) => source && path.resolve(source) === output)
  )
    throw new Error("replay_render_source_overwrite");
  try {
    await lstat(output);
    throw new Error("replay_render_output_exists");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const still = options.frame !== undefined;
  if (
    options.concurrency !== undefined &&
    (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1)
  )
    throw new Error("video_concurrency_invalid");
  if (
    options.timeoutMs !== undefined &&
    (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1)
  )
    throw new Error("video_render_timeout_invalid");
  if (path.extname(output) !== (still ? ".png" : ".mp4"))
    throw new Error("replay_render_output_extension_invalid");
  const end = prepared.plan.durationFrames - 1;
  const integer = (value: number | undefined) =>
    value === undefined || (Number.isSafeInteger(value) && value >= 0);
  if (![options.frame, options.fromFrame, options.toFrame].every(integer))
    throw new Error("replay_frame_invalid");
  if (still && (options.fromFrame !== undefined || options.toFrame !== undefined))
    throw new Error("video_frame_range_invalid");
  const from = options.fromFrame ?? 0,
    to = options.toFrame ?? end;
  if ((options.frame !== undefined && options.frame > end) || from > to || to > end)
    throw new Error("replay_frame_out_of_range");
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = await mkdtemp(path.join(path.dirname(output), ".awa-video-"));
  const artifact = path.join(temporary, still ? "artifact.png" : "artifact.mp4");
  let browser: Awaited<ReturnType<VideoRendering["openBrowser"]>> | undefined;
  const errors: unknown[] = [];
  try {
    const publicDir = path.join(temporary, "public");
    await mkdir(publicDir);
    await materializeVideo(prepared, publicDir);
    const entryPoint = await writeVideoEntry(prepared, temporary);
    const serveUrl = await rendering.bundle({
      entryPoint,
      outDir: path.join(temporary, "bundle"),
      publicDir,
    });
    browser = await rendering.openBrowser("chrome", {
      browserExecutable: options.browser,
      logLevel: "error",
    });
    const common = {
      serveUrl,
      inputProps: { plan: prepared.plan },
      puppeteerInstance: browser,
      logLevel: "error" as const,
      ...(options.timeoutMs === undefined ? {} : { timeoutInMilliseconds: options.timeoutMs }),
    };
    const composition = await rendering.selectComposition({ ...common, id: "Replay" });
    // 最终范围依据 renderer 真正解析的 composition 复验，避免生成入口与计划不一致。
    if ((options.frame ?? to) >= composition.durationInFrames)
      throw new Error("replay_frame_out_of_range");
    if (still)
      await rendering.renderStill({
        ...common,
        composition,
        frame: options.frame!,
        output: artifact,
        imageFormat: "png",
        overwrite: false,
      });
    else
      await rendering.renderMedia({
        ...common,
        composition,
        codec: "h264",
        outputLocation: artifact,
        frameRange: [from, to],
        concurrency: options.concurrency ?? 2,
        onProgress: options.onProgress,
        overwrite: false,
      });
    try {
      await link(artifact, output);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        throw new Error("replay_render_output_exists");
      throw error;
    }
  } catch (error) {
    errors.push(error);
  } finally {
    if (browser) {
      try {
        await browser.close({ silent: true });
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      await rm(temporary, { recursive: true, force: true });
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, "replay_render_and_cleanup_failed");
}
