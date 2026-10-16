/**
 * 负责输出可核对的视频来源与镜头索引。输入为显式复盘或项目路径，输出纯 JSON 摘要，不写文件或启动浏览器。
 * 来源指纹可复制到单局脚本；本命令不输出私有接入配置、不生成音频或修改归档。
 */
import { parseArgs } from "node:util";
import { prepareVideo } from "./prepare-video";
import { replayCommandFailure } from "./cli-error";

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    const { values } = parseArgs({
      args: args[0] === "--" ? args.slice(1) : args,
      strict: true,
      allowPositionals: false,
      options: { input: { type: "string" }, project: { type: "string" } },
    });
    const { plan } = await prepareVideo(values);
    console.log(
      JSON.stringify(
        {
          source: plan.source,
          fps: plan.fps,
          width: plan.width,
          height: plan.height,
          durationFrames: plan.durationFrames,
          shots: plan.shots.map(({ id, eventSeq, from, durationFrames }) => ({
            id,
            eventSeq,
            from,
            durationFrames,
          })),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(JSON.stringify(replayCommandFailure(error, "zh-CN")));
    process.exitCode = 1;
  }
}
