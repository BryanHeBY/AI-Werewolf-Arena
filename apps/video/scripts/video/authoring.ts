/**
 * 负责命令侧录像读取与声明式语音项目装配。输入为锁定来源和JSONL稿，输出记录或延迟编排的项目定义。
 * 项目工厂不读取录像、不编译计划；准备阶段执行编排，不调用TTS，不进入浏览器画面模块。
 */
import { readFileSync } from "node:fs";
import { parseOfflineReplayJson } from "@ai-werewolf-arena/game-media/replay/offline-replay";
import {
  defineVideoProject,
  type VideoProjectDefinition,
} from "@ai-werewolf-arena/game-media/video-project";
import {
  getVideoSourceIdentity,
  type VideoSourceIdentity,
} from "@ai-werewolf-arena/game-media/video/plan";
import { type SpeechScript } from "@ai-werewolf-arena/game-media/speech-script";
import type { SpeechManifest, SpeechProject } from "@ai-werewolf-arena/game-media/speech";

export function readVideoSource(file: string | URL, expected?: VideoSourceIdentity) {
  const recording = parseOfflineReplayJson(readFileSync(file, "utf8"));
  if (expected) {
    const source = getVideoSourceIdentity(recording);
    if (source.sessionId !== expected.sessionId || source.fingerprint !== expected.fingerprint)
      throw new Error("video_source_mismatch");
  }
  return recording;
}

export function createSpeechVideoProject(
  definition: VideoProjectDefinition,
  document: SpeechScript,
  options: {
    audio?: { project: SpeechProject; manifest: SpeechManifest };
  } = {},
): VideoProjectDefinition {
  if (!definition.script) throw new Error("video_script_required");
  return defineVideoProject({ ...definition, speech: { document, audio: options.audio } });
}
