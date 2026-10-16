/**
 * 负责单局视频的本地预览生命周期。输入为复盘或项目路径，输出使用同一已编译计划的 Vite 预览。
 * 本入口拥有临时素材目录和子进程，退出或中止后关闭并清理；不修改源文件、不调用语音服务。
 */
import { parseArgs } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { isLocale } from "@ai-werewolf-arena/game-contract";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { prepareVideo, materializeVideo } from "./prepare-video";
import { replayCommandFailure } from "./cli-error";

export async function previewVideo(
  args: string[],
  display: { locale: Locale } = { locale: "zh-CN" },
): Promise<number> {
  const { values } = parseArgs({
    args: args[0] === "--" ? args.slice(1) : args,
    strict: true,
    allowPositionals: false,
    options: {
      input: { type: "string" },
      project: { type: "string" },
      locale: { type: "string" },
      "time-zone": { type: "string" },
      port: { type: "string" },
    },
  });
  if (values.locale !== undefined && !isLocale(values.locale))
    throw new Error("replay_display_locale_invalid");
  const port = values.port ?? "5173";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error("video_preview_port_invalid");
  const prepared = await prepareVideo({
    input: values.input,
    project: values.project,
    locale: values.locale as Locale | undefined,
    timeZone: values["time-zone"],
  });
  display.locale = prepared.plan.display.locale;
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-video-preview-"));
  try {
    await materializeVideo(prepared, directory);
    const child = Bun.spawn(
      [
        "bun",
        "--no-env-file",
        path.resolve(import.meta.dir, "../node_modules/vite/bin/vite.js"),
        "--host",
        "127.0.0.1",
        "--port",
        port,
        "--strictPort",
      ],
      {
        cwd: path.resolve(import.meta.dir, ".."),
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env: {
          ...process.env,
          AWA_REPLAY_INPUT: prepared.sourcePath,
          AWA_VIDEO_PLAN_DIR: directory,
          AWA_VIDEO_PROJECT_ENTRY:
            prepared.layerNames.length || prepared.themeSlotNames?.length
              ? prepared.projectPath
              : undefined,
        },
      },
    );
    const stop = () => child.kill("SIGTERM");
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    console.log(`http://127.0.0.1:${port}/video.html`);
    try {
      return await child.exited;
    } finally {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const display: { locale: Locale } = { locale: "zh-CN" };
  try {
    process.exitCode = await previewVideo(process.argv.slice(2), display);
  } catch (error) {
    console.error(JSON.stringify(replayCommandFailure(error, display.locale)));
    process.exitCode = 1;
  }
}
