/**
 * 负责从完整已备语音编译连续配音项目。输入为画面项目、JSONL稿、选角和素材清单，输出WAV、真实时间报告、项目与可用SRT。
 * 本命令只读本地素材；缺失或过期语音报错，缺少对齐时记录未完成状态，不用阅读估时拼造字幕。
 */
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { loadVideoProject, compileLoadedVideo } from "./prepare-video";
import { readSpeechScriptProject, readSpeechManifest } from "./video/speech-script";
import { assembleSpeechAudio } from "./tts/assemble";
import { applySpeechScript } from "../src/speech-script";
import type { VideoProjectDefinition } from "../src/video-project";
import { publishVideoDirectory } from "./video/publication";
import { videoSubtitlesSrt } from "../src/video/subtitles";

export async function compileSpeechVideo(options: {
  project: string;
  script: string;
  casting: string;
  manifest: string;
  directory: string;
  requireSubtitles?: boolean;
}) {
  const loaded = await loadVideoProject({ project: options.project });
  const definition = { ...loaded.definition!, speech: undefined };
  const prepared = compileLoadedVideo(loaded, definition);
  const base = loaded.base;
  if ((prepared.layerNames.length || prepared.themeSlotNames?.length) && !definition.visuals)
    throw new Error("speech_script_visuals_module_required");
  const { document, project } = await readSpeechScriptProject(options.script, options.casting);
  const manifestFile = path.resolve(options.manifest),
    manifestDirectory = path.dirname(manifestFile);
  const normalized = await readSpeechManifest(manifestFile);
  const { script, timeline } = applySpeechScript(definition.script!, prepared.plan, document, {
    project,
    manifest: normalized,
  });
  if (script.maxDurationFrames !== undefined && timeline.durationFrames > script.maxDurationFrames)
    throw new Error("video_duration_budget_exceeded");
  const missingTiming = timeline.scenes
    .flatMap((scene) => scene.lines)
    .filter(
      (line) =>
        !line.subtitles?.length &&
        project.lines.find((item) => item.id === line.id)?.subtitles !== false,
    )
    .map((line) => line.id);
  if (options.requireSubtitles && missingTiming.length)
    throw new Error("speech_script_subtitles_incomplete");
  const directory = path.resolve(options.directory);
  return publishVideoDirectory(directory, async (candidate) => {
    const audio = await assembleSpeechAudio({
      timeline,
      manifest: normalized,
      manifestDirectory,
      directory: candidate,
    });
    const version = createHash("sha256")
      .update(JSON.stringify({ script, timeline, audio: audio.sha256 }))
      .digest("hex")
      .slice(0, 12);
    const publishedDirectory = path.join(directory, `build-${version}`);
    const publishedAudio = {
      ...audio,
      file: path.join(publishedDirectory, path.basename(audio.file)),
    };
    const masterId = `speech-master:${audio.sha256}`;
    script.media = [
      ...(script.media ?? [])
        .filter((asset) => !asset.id.startsWith("voice:"))
        .map((asset) => ({
          ...asset,
          src: /^(?:file:|https?:)/.test(asset.src)
            ? asset.src
            : pathToFileURL(path.resolve(base, asset.src)).href,
        })),
      {
        id: masterId,
        kind: "audio",
        src: pathToFileURL(publishedAudio.file).href,
        durationFrames: timeline.durationFrames,
      },
    ];
    script.shotEdits = script.shotEdits?.map((edit) => ({
      ...edit,
      speech: edit.speech?.map(({ assetId: _asset, ...cue }) => cue),
    }));
    script.audio = [
      ...(script.audio ?? []),
      {
        id: "speech-master",
        assetId: masterId,
        from: 0,
        durationFrames: timeline.durationFrames,
        track: "voice",
      },
    ];
    const contract = path.resolve(import.meta.dir, "../src/video-project");
    let contractImport = path.relative(publishedDirectory, contract).split(path.sep).join("/");
    if (!contractImport.startsWith(".")) contractImport = `./${contractImport}`;
    const result: VideoProjectDefinition = {
      ...definition,
      speech: undefined,
      input: prepared.sourcePath,
      script,
      ...(definition.visuals ? { visuals: path.resolve(base, definition.visuals) } : {}),
      ...(definition.fonts
        ? {
            fonts: definition.fonts.map((font) => ({
              ...font,
              src: font.src.startsWith("file:")
                ? font.src
                : pathToFileURL(path.resolve(base, font.src)).href,
            })),
          }
        : {}),
    };
    const output = path.join(publishedDirectory, `voiced-${version}.project.ts`);
    const code = `/** 负责保存已备语音生成的项目。输入为锁定台词和音频，输出连续时间线；重新编译生成新版本，不手改此文件。 */\nimport { defineVideoProject } from ${JSON.stringify(contractImport)};\nexport default defineVideoProject(${JSON.stringify(result, null, 2)});\n`;
    const { plan } = compileLoadedVideo(loaded, result);
    await writeFile(path.join(candidate, path.basename(output)), code);
    await writeFile(
      path.join(candidate, "speech-timeline.json"),
      JSON.stringify({ ...timeline, audio: publishedAudio }, null, 2) + "\n",
    );
    await writeFile(
      path.join(candidate, "subtitle-status.json"),
      JSON.stringify({ complete: !missingTiming.length, missingTiming }, null, 2) + "\n",
    );
    // 不发布缺段SRT冒充整片字幕；带内容版本的文件也不会保留旧版本的完成状态。
    const subtitles = !missingTiming.length
      ? path.join(publishedDirectory, `subtitles-${version}.srt`)
      : undefined;
    if (subtitles)
      await writeFile(path.join(candidate, path.basename(subtitles)), videoSubtitlesSrt(plan));
    const value = {
      output,
      audio: publishedAudio.file,
      seconds: plan.durationFrames / plan.fps,
      scenes: plan.shots.length,
      subtitles: subtitles ?? null,
      missingTiming: missingTiming.length,
    };
    await writeFile(path.join(candidate, "build.json"), JSON.stringify(value, null, 2) + "\n");
    return { name: `build-${version}`, value };
  });
}
if (import.meta.main) {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      strict: true,
      options: {
        project: { type: "string" },
        script: { type: "string" },
        casting: { type: "string" },
        manifest: { type: "string" },
        output: { type: "string" },
        "require-subtitles": { type: "boolean" },
      },
    });
    if (!values.project || !values.script || !values.casting || !values.manifest || !values.output)
      throw new Error("speech_script_arguments_required");
    console.log(
      JSON.stringify(
        await compileSpeechVideo({
          project: values.project,
          script: values.script,
          casting: values.casting,
          manifest: values.manifest,
          directory: values.output,
          requireSubtitles: values["require-subtitles"],
        }),
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        error:
          error instanceof Error && /^(speech_|tts_|video_)[a-zA-Z0-9_:.-]+$/.test(error.message)
            ? error.message
            : "speech_script_compile_failed",
      }),
    );
    process.exitCode = 1;
  }
}
