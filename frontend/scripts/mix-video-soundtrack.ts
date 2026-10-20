/** 负责从导演配乐稿生成独立混音版本。输入为实际语音时间线和TS编排，输出可复用母带；全程只读本地素材。 */
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { mixVideoSoundtrack, type VideoSoundtrack } from "./video/soundtrack";

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      timeline: { type: "string" },
      soundtrack: { type: "string" },
      output: { type: "string" },
    },
  });
  if (!values.timeline || !values.soundtrack || !values.output)
    throw new Error("soundtrack_arguments_required");
  const soundtrack = (await import(pathToFileURL(path.resolve(values.soundtrack)).href))
    .default as VideoSoundtrack;
  const result = await mixVideoSoundtrack({
    timeline: path.resolve(values.timeline),
    soundtrack,
    directory: path.resolve(values.output),
  });
  console.log(
    JSON.stringify({
      directory: result.directory,
      master: result.master,
      seconds: result.samples / result.sampleRate,
      music: result.music.length,
      effects: result.effects.length,
      ducking: result.ducking,
      masterGain: result.masterGain,
    }),
  );
}
