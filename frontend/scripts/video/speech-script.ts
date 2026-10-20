/** 负责读取本地JSONL语音稿与独立选角。输入为显式文件路径，输出语音文档或配音项目；不读取凭据或调用TTS。 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { parseSpeechScriptJsonl, speechProjectFromScript } from "../../src/speech-script";
import type { SpeechManifest, SpeechProject } from "../../src/speech";

export function readSpeechScript(file: string | URL) {
  return parseSpeechScriptJsonl(readFileSync(file, "utf8"));
}

/** 清单中的相对音频归清单目录，转换后可供任意位置的有声项目共用。 */
export async function readSpeechManifest(file: string): Promise<SpeechManifest> {
  const absolute = path.resolve(file);
  const manifest = (await import(pathToFileURL(absolute).href)).default as SpeechManifest;
  return Object.fromEntries(
    Object.entries(manifest).map(([id, value]) => [
      id,
      {
        ...value,
        src: value.src.startsWith("file:")
          ? value.src
          : pathToFileURL(path.resolve(path.dirname(absolute), value.src)).href,
      },
    ]),
  );
}

export async function readSpeechScriptProject(file: string, castingFile: string) {
  const document = readSpeechScript(path.resolve(file));
  const module = await import(pathToFileURL(path.resolve(castingFile)).href);
  const casting = (module.casting ?? module.default) as SpeechProject["casting"];
  if (!casting || typeof casting !== "object" || Array.isArray(casting))
    throw new Error("speech_script_casting_invalid");
  return { document, project: speechProjectFromScript(document, casting) };
}
