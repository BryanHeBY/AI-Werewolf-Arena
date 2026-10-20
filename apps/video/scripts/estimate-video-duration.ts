/**
 * 负责估算完整配音视频时长。输入为编译计划、台词选角和本地试听测量，输出逐镜头估时及语速区间。
 * 仅用实际字符量和已测语速推算，不调用TTS；最终时长仍以准备后的音频采样数为准。
 */
import {
  scheduleSpeechScene,
  LEGACY_SPEECH_TIMING,
} from "@ai-werewolf-arena/game-media/speech-clock";
import { parseArgs } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { prepareVideo } from "./prepare-video";
import { splitSpeechText } from "./tts/prepare";
import { tencentSpeedRatio } from "./tts/tencent-speed";
import { voiceSpeedRatio } from "./tts/voices";
import { videoSpeechLineId, type SpeechProject } from "@ai-werewolf-arena/game-media/speech";
import type { VideoPlan } from "@ai-werewolf-arena/game-media/video/plan";

export interface VoiceCalibration {
  provider?: "tencent" | "volcengine";
  voiceId: number | string;
  /** 对应服务商原生语速参数；旧样本缺省provider时按腾讯云解释。 */
  speed: number;
  characters: number;
  seconds: number;
}
export function estimateVideoDuration(
  plan: VideoPlan,
  project: SpeechProject,
  samples: VoiceCalibration[] = [],
) {
  for (const sample of samples)
    if (
      !Number.isFinite(sample.characters) ||
      sample.characters <= 0 ||
      !Number.isFinite(sample.seconds) ||
      sample.seconds <= 0 ||
      !Number.isFinite(sample.speed) ||
      (sample.provider !== undefined && !["tencent", "volcengine"].includes(sample.provider)) ||
      (sample.provider === "volcengine" && (sample.speed < -50 || sample.speed > 100))
    )
      throw new Error("video_calibration_invalid");
  const sampleRatio = (item: VoiceCalibration) =>
    item.provider === "volcengine" ? 1 + item.speed / 100 : tencentSpeedRatio(item.speed);
  const fallback = samples.length
    ? samples.reduce((sum, item) => sum + item.characters / sampleRatio(item), 0) /
      samples.reduce((sum, item) => sum + item.seconds, 0)
    : 4.3;
  const speakers: Record<
    string,
    { voice: string; characters: number; seconds: number; calibrated: boolean }
  > = {};
  let characters = 0;
  let measuredVoiceCharacters = 0;
  const shots = plan.shots.map((shot, shotIndex) => {
    let seconds = shot.speech[0]?.from ? shot.speech[0].from / plan.fps : 0;
    let shotCharacters = 0;
    let count = 0;
    const durations: Array<{
      id: string;
      speaker: (typeof project.lines)[number]["speaker"];
      speechSeconds: number;
      gaps: number;
      pauseAfterMs?: number;
    }> = [];
    for (const [index] of shot.speech.filter((cue) => cue.text.trim()).entries()) {
      const id = videoSpeechLineId(shot.id, index);
      const line = project.lines.find((item) => item.id === id);
      if (!line) throw new Error(`video_estimate_line_missing:${id}`);
      const voice = line.voice ?? project.casting[line.speaker];
      if (!voice) throw new Error(`video_estimate_voice_missing:${id}`);
      const text = line.spokenText ?? line.text;
      const units = Array.from(text.replace(/\s/g, "")).length;
      shotCharacters += units;
      const matches = samples.filter(
        (item) => item.voiceId === voice.voiceId && (item.provider ?? "tencent") === voice.provider,
      );
      const baseRate = matches.length
        ? matches.reduce((sum, item) => sum + item.characters / sampleRatio(item), 0) /
          matches.reduce((sum, item) => sum + item.seconds, 0)
        : fallback;
      const rate = baseRate * voiceSpeedRatio(voice);
      const speechSeconds = units / rate;
      const gaps =
        (((line.synthesisChunks ?? splitSpeechText(text)).length - 1) *
          (project.chunkGapMs ?? 160)) /
        1000;
      const speaker = (speakers[line.speaker] ??= {
        voice: voice.name,
        characters: 0,
        seconds: 0,
        calibrated: Boolean(matches.length),
      });
      speaker.characters += units;
      speaker.seconds += speechSeconds + gaps;
      characters += units;
      if (matches.length) measuredVoiceCharacters += units;
      durations.push({
        id,
        speaker: line.speaker,
        speechSeconds,
        gaps,
        pauseAfterMs: line.pauseAfterMs,
      });
      count++;
    }
    const nextShot = plan.shots[shotIndex + 1];
    const schedule = (speed: number) =>
      scheduleSpeechScene({
        fps: plan.fps,
        policy: project.timing ?? LEGACY_SPEECH_TIMING,
        startFrame: project.timing ? 0 : (shot.speech[0]?.from ?? 0),
        minimumFrames:
          !count || (!project.timing && shot.kind === "hold") ? shot.durationFrames : 0,
        nextSpeaker: nextShot?.speech[0]?.speaker,
        boundary: !nextShot
          ? "ending"
          : shot.scene.resolution || shot.scene.kind === "settlement"
            ? "result"
            : shot.scene.kind === "phase" || nextShot.scene.kind === "phase"
              ? "phase"
              : "scene",
        lines: durations.map(({ speechSeconds, gaps, ...line }) => ({
          ...line,
          durationFrames: Math.max(1, Math.ceil((speechSeconds / speed + gaps) * plan.fps)),
        })),
      }).durationFrames / plan.fps;
    seconds = schedule(1);
    return {
      id: shot.id,
      title: shot.scene.title,
      characters: shotCharacters,
      seconds,
      fasterSeconds: schedule(1.15),
      slowerSeconds: schedule(0.85),
    };
  });
  return {
    method: "local_sample_character_rate",
    characters,
    shots: shots.length,
    calibratedCharacters: measuredVoiceCharacters,
    fallbackCharactersPerSecond: fallback,
    estimatedSeconds: shots.reduce((sum, shot) => sum + shot.seconds, 0),
    fasterSeconds: shots.reduce((sum, shot) => sum + shot.fasterSeconds, 0),
    slowerSeconds: shots.reduce((sum, shot) => sum + shot.slowerSeconds, 0),
    readingClockSeconds: plan.durationFrames / plan.fps,
    speakers,
    timeline: shots,
  };
}
if (import.meta.main) {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      strict: true,
      options: {
        project: { type: "string" },
        dialogue: { type: "string" },
        calibration: { type: "string" },
        output: { type: "string" },
      },
    });
    if (!values.project || !values.dialogue)
      throw new Error("video_estimate_project_dialogue_required");
    const { plan } = await prepareVideo({ project: values.project, assets: false });
    const project = (await import(pathToFileURL(path.resolve(values.dialogue)).href))
      .default as SpeechProject;
    const calibration = values.calibration
      ? (JSON.parse(await readFile(values.calibration, "utf8")) as VoiceCalibration[])
      : [];
    const report = estimateVideoDuration(plan, project, calibration);
    if (values.output) {
      await mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
      await writeFile(values.output, JSON.stringify(report, null, 2) + "\n");
    }
    console.log(JSON.stringify({ ...report, timeline: undefined }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "video_estimate_failed");
    process.exitCode = 1;
  }
}
