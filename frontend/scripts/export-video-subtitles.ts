/** 负责离线导出配音字幕。输入为已经绑定语音的视频项目，输出SRT文件；复用正式编译时间轴，不读取凭据或调用合成。 */
import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prepareVideo } from "./prepare-video";
import { videoSubtitlesSrt } from "../src/video/subtitles";

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    const { values } = parseArgs({
      args: args[0] === "--" ? args.slice(1) : args,
      strict: true,
      options: {
        project: { type: "string" },
        output: { type: "string" },
      },
    });
    if (!values.project || !values.output) throw new Error("video_subtitle_arguments_required");
    const { plan } = await prepareVideo({ project: path.resolve(values.project), assets: false });
    if (!plan.subtitles?.length) throw new Error("video_subtitles_missing");
    const output = path.resolve(values.output);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, videoSubtitlesSrt(plan), { flag: "wx" });
    console.log(JSON.stringify({ output, cues: plan.subtitles.length }));
  } catch (error) {
    console.error(
      JSON.stringify({
        error:
          error instanceof Error && /^(video_|speech_)[a-zA-Z0-9_:.-]+$/.test(error.message)
            ? error.message
            : "video_subtitle_export_failed",
      }),
    );
    process.exitCode = 1;
  }
}
