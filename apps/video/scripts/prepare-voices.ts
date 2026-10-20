/** 负责显式语音准备命令。输入为台词项目路径，输出检查报告和语音素材；dry-run/check不联网，不参与渲染。 */
import { projectDataPath } from "@ai-werewolf-arena/project-paths";
import { parseArgs } from "node:util";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { SpeechProject } from "@ai-werewolf-arena/game-media/speech";
import { inspectSpeech, prepareSpeech } from "./tts/prepare";
import { createSpeechProvider } from "./tts/providers";
import { readSpeechScriptProject } from "./video/speech-script";
import { defaultSpeechManifest } from "./video/production";

if (import.meta.main) {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      strict: true,
      options: {
        project: { type: "string" },
        script: { type: "string" },
        casting: { type: "string" },
        cache: { type: "string" },
        manifest: { type: "string" },
        "dry-run": { type: "boolean" },
        check: { type: "boolean" },
        only: { type: "string" },
      },
    });
    if (
      Boolean(values.project) === Boolean(values.script) ||
      (values.script && !values.casting) ||
      (values.project && values.casting)
    )
      throw new Error("tts_project_required");
    const entry = path.resolve((values.project ?? values.script)!);
    const project = values.script
      ? (await readSpeechScriptProject(entry, values.casting!)).project
      : ((await import(pathToFileURL(entry).href)).default as SpeechProject);
    const directory = path.resolve(
      values.cache ?? path.join(projectDataPath("output"), "tts-cache"),
    );
    const manifestPath = values.manifest
      ? path.resolve(values.manifest)
      : defaultSpeechManifest(entry);
    const report = await inspectSpeech(project, directory);
    console.log(
      JSON.stringify({
        lines: report.entries.length,
        cached: report.entries.filter((item) => item.cached).length,
        timed: report.entries.filter((item) => item.cached?.alignment).length,
        characters: report.characters,
        missingCharacters: report.missingCharacters,
      }),
    );
    if (!values["dry-run"])
      await prepareSpeech({
        project,
        directory,
        manifestPath,
        provider: createSpeechProvider(),
        check: values.check,
        only: values.only?.split(","),
        onProgress: (value) => console.log(JSON.stringify(value)),
      });
  } catch (error) {
    const message =
      error instanceof Error && /^(tts_|speech_)[a-zA-Z0-9_:.-]+$/.test(error.message)
        ? error.message
        : "tts_prepare_failed";
    console.error(JSON.stringify({ error: message }));
    process.exitCode = 1;
  }
}
