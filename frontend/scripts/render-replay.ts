/**
 * 负责将已校验复盘离线渲染为 PNG 或 MP4。输入为 CLI 参数与渲染依赖，输出独占发布的目标文件或原错误集合。
 * 本命令拥有临时目录和浏览器的创建／关闭；渲染完成后才发布，源归档与已存在目标不覆盖。
 * 清理失败与渲染失败按发生顺序汇总；显示选项不改变归档事实，画面仍由同一帧输入构建。
 */
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { parseArgs } from "node:util";
import { mkdtemp, mkdir, readFile, rm, lstat, link } from "node:fs/promises";
import path from "node:path";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { replayCommandFailure } from "./cli-error";
import { isLocale } from "@ai-werewolf-arena/game-contract";
import { resolveReplayInput } from "./replay-dev";
import { parseOfflineReplayJson } from "../src/replay/offline-replay";
import { createReplayRenderInput, FRAMES_PER_EVENT } from "../src/replay/replay-frame";
import { DEFAULT_REPLAY_TIME_ZONE } from "../src/replay/replay-display";

const defaultRendering = { bundle, openBrowser, selectComposition, renderStill, renderMedia };
export async function renderReplay(
  args: string[],
  rendering = defaultRendering,
  display?: { locale: Locale },
) {
  const { values } = parseArgs({
    args: args[0] === "--" ? args.slice(1) : args,
    options: {
      input: { type: "string" },
      output: { type: "string" },
      locale: { type: "string" },
      "time-zone": { type: "string" },
      frame: { type: "string" },
      browser: { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (display && isLocale(values.locale)) display.locale = values.locale;
  if (!values.input || !values.output) throw new Error("replay_render_input_output_required");
  const source = resolveReplayInput(values.input);
  const output = path.resolve(values.output);
  if (path.resolve(source) === output) throw new Error("replay_render_source_overwrite");
  // 打包和启动浏览器前先拒绝已有目标，包含符号链接；实际发布时仍需防止检查后的路径竞争。
  try {
    await lstat(output);
    throw new Error("replay_render_output_exists");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const replay = parseOfflineReplayJson(await readFile(source, "utf8"));
  const locale = values.locale ?? replay.meta.locale ?? "zh-CN";
  if (!isLocale(locale)) throw new Error("replay_display_locale_invalid");
  if (display) display.locale = locale;
  const inputProps = {
    ...createReplayRenderInput(replay, {
      locale,
      timeZone: values["time-zone"] ?? DEFAULT_REPLAY_TIME_ZONE,
    }),
  };
  const still = values.frame !== undefined;
  const frame = still ? Number(values.frame) : undefined;
  if (still && (!/^\d+$/.test(values.frame!) || !Number.isSafeInteger(frame)))
    throw new Error("replay_frame_invalid");
  if (path.extname(output) !== (still ? ".png" : ".mp4"))
    throw new Error("replay_render_output_extension_invalid");
  if (
    frame !== undefined &&
    frame >= Math.max(inputProps.replay.events.length * FRAMES_PER_EVENT, 1)
  )
    throw new Error("replay_frame_out_of_range");
  await mkdir(path.dirname(output), { recursive: true });
  // 临时产物留在目标目录所在文件系统，最后用硬链接独占发布，避免覆盖并发创建的目标。
  const temporary = await mkdtemp(path.join(path.dirname(output), ".awa-replay-render-"));
  const artifact = path.join(temporary, still ? "artifact.png" : "artifact.mp4");
  let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
  const errors: unknown[] = [];
  try {
    const serveUrl = await rendering.bundle({
      entryPoint: path.resolve(import.meta.dir, "../src/replay/remotion-entry.tsx"),
      outDir: path.join(temporary, "bundle"),
    });
    browser = await rendering.openBrowser("chrome", {
      browserExecutable: values.browser,
      logLevel: "error",
    });
    const common = { serveUrl, inputProps, puppeteerInstance: browser, logLevel: "error" as const };
    const composition = await rendering.selectComposition({ ...common, id: "Replay" });
    if (frame !== undefined && frame >= composition.durationInFrames)
      throw new Error("replay_frame_out_of_range");
    if (still)
      await rendering.renderStill({
        ...common,
        composition,
        frame,
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
        concurrency: 2,
        overwrite: false,
      });
    // 只有完整渲染成功才建立目标链接；发布失败保原文件与临时产物清理路径。
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
    // 各项清理独立尝试；浏览器关闭失败也继续删本次临时目录，错误保留原发生顺序。
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
if (import.meta.main) {
  const display: { locale: Locale } = { locale: "zh-CN" };
  try {
    await renderReplay(process.argv.slice(2), defaultRendering, display);
  } catch (error) {
    console.error(JSON.stringify(replayCommandFailure(error, display.locale)));
    process.exitCode = 1;
  }
}
