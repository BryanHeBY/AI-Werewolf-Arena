/**
 * 负责兼容原复盘导出命令。输入为原 CLI 参数及可注入渲染依赖，输出通用视频计划的 PNG 或 MP4。
 * 原文件保护、范围校验与资源关闭交同一产物 owner，预览和导出共用计划；不修改归档或调用 TTS。
 */
import { parseArgs } from "node:util";
import { isLocale } from "@ai-werewolf-arena/game-contract";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { prepareVideo } from "./prepare-video";
import { defaultVideoRendering, renderVideoArtifact } from "./render-video-artifact";
import { replayCommandFailure } from "./cli-error";

export async function renderReplay(
  args: string[],
  rendering = defaultVideoRendering,
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
  if (values.locale !== undefined && !isLocale(values.locale))
    throw new Error("replay_display_locale_invalid");
  if (
    values.frame !== undefined &&
    (!/^\d+$/.test(values.frame) || !Number.isSafeInteger(Number(values.frame)))
  )
    throw new Error("replay_frame_invalid");
  const prepared = await prepareVideo({
    input: values.input,
    locale: values.locale as Locale | undefined,
    timeZone: values["time-zone"],
  });
  if (display) display.locale = prepared.plan.display.locale;
  await renderVideoArtifact(
    prepared,
    {
      output: values.output,
      frame: values.frame === undefined ? undefined : Number(values.frame),
      browser: values.browser,
    },
    rendering,
  );
}

if (import.meta.main) {
  const display: { locale: Locale } = { locale: "zh-CN" };
  try {
    await renderReplay(process.argv.slice(2), defaultVideoRendering, display);
  } catch (error) {
    console.error(JSON.stringify(replayCommandFailure(error, display.locale)));
    process.exitCode = 1;
  }
}
