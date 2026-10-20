/**
 * 负责通用视频导出 CLI。输入为复盘或单局脚本、显示选项及帧范围，输出统一计划的 PNG/MP4。
 * 文件和浏览器资源交给准备与产物 owner；本入口只校验参数，不修改游戏事实或执行语音生成。
 */
import { parseArgs } from "node:util";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { isLocale } from "@ai-werewolf-arena/game-contract";
import { prepareVideo } from "./prepare-video";
import { renderVideoArtifact } from "./render-video-artifact";
import { replayCommandFailure } from "@ai-werewolf-arena/game-media/cli-error";

export async function renderVideo(
  args: string[],
  display: { locale: Locale } = { locale: "zh-CN" },
): Promise<void> {
  const { values } = parseArgs({
    args: args[0] === "--" ? args.slice(1) : args,
    strict: true,
    allowPositionals: false,
    options: {
      input: { type: "string" },
      project: { type: "string" },
      output: { type: "string" },
      locale: { type: "string" },
      "time-zone": { type: "string" },
      browser: { type: "string" },
      frame: { type: "string" },
      "from-frame": { type: "string" },
      "to-frame": { type: "string" },
      concurrency: { type: "string" },
    },
  });
  if (values.locale !== undefined) {
    if (!isLocale(values.locale)) throw new Error("replay_display_locale_invalid");
    display.locale = values.locale;
  }
  if (!values.output) throw new Error("replay_render_input_output_required");
  const number = (value?: string) => {
    if (value === undefined) return undefined;
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
      throw new Error("replay_frame_invalid");
    return Number(value);
  };
  const frame = number(values.frame),
    fromFrame = number(values["from-frame"]),
    toFrame = number(values["to-frame"]),
    concurrency = number(values.concurrency);
  const prepared = await prepareVideo({
    input: values.input,
    project: values.project,
    locale: values.locale as Locale | undefined,
    timeZone: values["time-zone"],
  });
  display.locale = prepared.plan.display.locale;
  let lastProgressAt = 0;
  await renderVideoArtifact(prepared, {
    output: values.output,
    frame,
    fromFrame,
    toFrame,
    browser: values.browser,
    concurrency,
    onProgress: ({ renderedFrames, encodedFrames, progress }) => {
      const now = Date.now();
      if (now - lastProgressAt < 10000 && progress < 1) return;
      lastProgressAt = now;
      console.log(
        JSON.stringify({ type: "video_render_progress", renderedFrames, encodedFrames, progress }),
      );
    },
  });
}

if (import.meta.main) {
  const display: { locale: Locale } = { locale: "zh-CN" };
  try {
    await renderVideo(process.argv.slice(2), display);
  } catch (error) {
    console.error(JSON.stringify(replayCommandFailure(error, display.locale)));
    process.exitCode = 1;
  }
}
