/**
 * 负责JSONL语音稿与增量镜头时钟。输入为完整场景台词、原生计划及可选已备语音，输出连续的局部覆盖和时间报告。
 * 原话、字幕和音色仍走统一配音契约；这里只累加时长，不生成字幕边界、改写游戏事实或调用服务商。
 */
import {
  scheduleSpeechScene,
  validateSpeechTimingPolicy,
  CONTINUOUS_SPEECH_TIMING,
  type SpeechTimingPolicy,
} from "./speech-clock";
import { retimeSpeechVisuals } from "./speech-visual-time";
import { estimateVideoReadFrames } from "./video/captions";
import { isVideoSpeaker } from "./video/speakers";
import {
  preparedSpeech,
  type DialogueLine,
  type SpeechManifest,
  type SpeechProject,
} from "./speech";
import type {
  VideoPlan,
  VideoScript,
  VideoSourceIdentity,
  SpeechCue,
  MediaAsset,
} from "./video/types";

export interface SpeechScriptLine extends DialogueLine {
  kind: "narration" | "dialogue";
  /** 台词开始时揭晓本场景主体或原生合段结果；不设置时主体从场景起点可读。 */
  cue?: "impact" | "result";
  pauseAfterMs?: number;
}
export interface SpeechScriptScene {
  type: "scene";
  id: string;
  title: string;
  source: { eventSeqs: number[]; factSeqs: number[] };
  lines: SpeechScriptLine[];
}
export interface SpeechScript {
  header: {
    type: "script";
    version: 1;
    source: VideoSourceIdentity;
    chunkGapMs: number;
    timing?: SpeechTimingPolicy;
  };
  scenes: SpeechScriptScene[];
}
export interface SpeechTimeline {
  version: 1;
  source: VideoSourceIdentity;
  timing: "estimated" | "audio";
  fps: number;
  durationFrames: number;
  scenes: Array<{
    id: string;
    from: number;
    durationFrames: number;
    lines: Array<{
      id: string;
      speaker: DialogueLine["speaker"];
      text: string;
      from: number;
      durationFrames: number;
      pauseFrames: number;
      audioDurationMs?: number;
      subtitles?: SpeechCue["subtitles"];
    }>;
  }>;
}
const fail = (reason: string): never => {
  throw new Error(`speech_script_${reason}`);
};
const keys = (value: object, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const nonempty = (value: unknown): value is string =>
  typeof value === "string" && Boolean(value.trim());

export function parseSpeechScriptJsonl(input: string): SpeechScript {
  let rows: unknown[];
  try {
    rows = input
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch {
    return fail("jsonl_invalid");
  }
  const [header, ...scenes] = rows;
  if (
    !record(header) ||
    !keys(header, ["type", "version", "source", "chunkGapMs", "timing"]) ||
    header.type !== "script" ||
    header.version !== 1 ||
    !record(header.source) ||
    !keys(header.source, ["sessionId", "fingerprint"]) ||
    !nonempty(header.source.sessionId) ||
    !nonempty(header.source.fingerprint) ||
    !Number.isSafeInteger(header.chunkGapMs) ||
    Number(header.chunkGapMs) < 0 ||
    Number(header.chunkGapMs) > 2000 ||
    !scenes.length
  )
    return fail("header_invalid");
  if (header.timing !== undefined) validateSpeechTimingPolicy(header.timing as SpeechTimingPolicy);
  const sceneIds = new Set<string>(),
    lineIds = new Set<string>();
  for (const scene of scenes) {
    if (
      !record(scene) ||
      !keys(scene, ["type", "id", "title", "source", "lines"]) ||
      scene.type !== "scene" ||
      !nonempty(scene.id) ||
      sceneIds.has(scene.id) ||
      !nonempty(scene.title) ||
      !record(scene.source) ||
      !keys(scene.source, ["eventSeqs", "factSeqs"]) ||
      ![scene.source.eventSeqs, scene.source.factSeqs].every(
        (seqs) =>
          Array.isArray(seqs) &&
          new Set(seqs).size === seqs.length &&
          seqs.every((seq) => Number.isSafeInteger(seq) && seq > 0),
      ) ||
      !Array.isArray(scene.lines) ||
      !scene.lines.length
    )
      return fail("scene_invalid");
    sceneIds.add(scene.id);
    const cues = new Set<string>();
    for (const line of scene.lines) {
      if (
        !record(line) ||
        !keys(line, [
          "id",
          "kind",
          "speaker",
          "text",
          "spokenText",
          "synthesisChunks",
          "voice",
          "take",
          "subtitles",
          "cue",
          "pauseAfterMs",
        ]) ||
        typeof line.id !== "string" ||
        !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(line.id) ||
        lineIds.has(line.id) ||
        !nonempty(line.text) ||
        !["narration", "dialogue"].includes(String(line.kind)) ||
        !isVideoSpeaker(line.speaker) ||
        (line.kind === "dialogue") !== line.speaker.startsWith("player:") ||
        (line.spokenText !== undefined && !nonempty(line.spokenText)) ||
        (line.synthesisChunks !== undefined &&
          (!Array.isArray(line.synthesisChunks) ||
            !line.synthesisChunks.length ||
            line.synthesisChunks.some(
              (value) => !nonempty(value) || Array.from(value).length > 140,
            ) ||
            line.synthesisChunks.join("") !== (line.spokenText ?? line.text))) ||
        (line.take !== undefined && !nonempty(line.take)) ||
        (line.pauseAfterMs !== undefined &&
          (!Number.isSafeInteger(line.pauseAfterMs) ||
            Number(line.pauseAfterMs) < 0 ||
            Number(line.pauseAfterMs) > 10000)) ||
        (line.cue !== undefined &&
          (!["impact", "result"].includes(String(line.cue)) || cues.has(String(line.cue))))
      )
        return fail("line_invalid");
      lineIds.add(line.id);
      if (line.cue) cues.add(String(line.cue));
    }
  }
  return { header, scenes } as unknown as SpeechScript;
}
export function speechScriptJsonl(script: SpeechScript): string {
  return [script.header, ...script.scenes].map((row) => JSON.stringify(row)).join("\n") + "\n";
}
/** 画面完整副本可引用稳定场景ID，口播只在JSONL维护一次；自由说明正文仍由视觉稿拥有。 */
export function speechSceneLines(script: SpeechScript, id: string): SpeechScriptLine[] {
  const scene = script.scenes.find((item) => item.id === id);
  if (!scene) return fail(`scene_missing:${id}`);
  return scene.lines;
}
export function speechSceneCues(script: SpeechScript, id: string): SpeechCue[] {
  return speechSceneLines(script, id).map((line) => ({
    speaker: line.speaker,
    text: line.spokenText ?? line.text,
  }));
}
export function speechSceneDialogue(script: SpeechScript, id: string): string {
  return speechSceneLines(script, id)
    .filter((line) => line.kind === "dialogue")
    .map((line) => line.text)
    .join("");
}
export function speechProjectFromScript(
  script: SpeechScript,
  casting: SpeechProject["casting"],
): SpeechProject {
  return {
    casting,
    timing: script.header.timing ?? CONTINUOUS_SPEECH_TIMING,
    chunkGapMs: script.header.chunkGapMs,
    lines: script.scenes.flatMap((scene) =>
      scene.lines.map(({ kind: _kind, cue: _cue, ...line }) => ({ ...line })),
    ),
  };
}

/** 估时仅供无声预览；有声构建必须提供完整素材，不能用旧页面时长掩盖缺失的语音。 */
export function applySpeechScript(
  script: VideoScript,
  plan: VideoPlan,
  document: SpeechScript,
  audio?: { project: SpeechProject; manifest: SpeechManifest },
): { script: VideoScript; timeline: SpeechTimeline } {
  if (
    document.header.source.sessionId !== plan.source.sessionId ||
    document.header.source.fingerprint !== plan.source.fingerprint
  )
    fail("source_mismatch");
  if (
    document.scenes.length !== plan.shots.length ||
    document.scenes.some((scene, index) => scene.id !== plan.shots[index]!.id)
  )
    fail("scene_order_mismatch");
  const edits = new Map((script.shotEdits ?? []).map((edit) => [edit.id, edit]));
  const media = new Map<string, MediaAsset>((script.media ?? []).map((asset) => [asset.id, asset]));
  const resolvedSpeech = audio
    ? {
        ...speechProjectFromScript(document, audio.project.casting),
        subtitles: audio.project.subtitles,
      }
    : undefined;
  const timeline: SpeechTimeline = {
    version: 1,
    source: { ...document.header.source },
    timing: audio ? "audio" : "estimated",
    fps: plan.fps,
    durationFrames: 0,
    scenes: [],
  };
  for (const [index, scene] of document.scenes.entries()) {
    const shot = plan.shots[index]!;
    if (
      JSON.stringify(scene.source.eventSeqs) !== JSON.stringify(shot.sourceSeqs) ||
      JSON.stringify(scene.source.factSeqs) !== JSON.stringify(shot.sourceFacts)
    )
      fail(`scene_source_mismatch:${scene.id}`);
    const speech: SpeechCue[] = [],
      lines: SpeechTimeline["scenes"][number]["lines"] = [];
    const boundLines = scene.lines.map((line) =>
      audio ? preparedSpeech(resolvedSpeech!, audio.manifest, line.id, plan.fps) : undefined,
    );
    const nextShot = plan.shots[index + 1];
    const schedule = scheduleSpeechScene({
      fps: plan.fps,
      policy: document.header.timing ?? CONTINUOUS_SPEECH_TIMING,
      nextSpeaker: document.scenes[index + 1]?.lines[0]?.speaker,
      boundary: !nextShot
        ? "ending"
        : shot.scene.resolution || shot.scene.kind === "settlement"
          ? "result"
          : shot.scene.kind === "phase" || nextShot.scene.kind === "phase"
            ? "phase"
            : "scene",
      lines: scene.lines.map((line, i) => ({
        ...line,
        durationFrames:
          boundLines[i]?.durationFrames ??
          Math.max(1, estimateVideoReadFrames(line.spokenText ?? line.text, plan.fps)),
      })),
    });
    const cursor = schedule.durationFrames;
    let impact: number | undefined, result: number | undefined;
    for (const [i, line] of scene.lines.entries()) {
      const bound = boundLines[i];
      const { from, durationFrames, pauseFrames } = schedule.lines[i]!;
      if (bound) media.set(bound.media.id, bound.media);
      if (line.cue === "impact") impact = from;
      if (line.cue === "result") result = from;
      speech.push({
        ...(bound?.cue ?? {
          speaker: line.speaker,
          text: line.spokenText ?? line.text,
          durationFrames,
        }),
        from,
      });
      const entry = audio?.manifest[line.id];
      lines.push({
        id: line.id,
        speaker: line.speaker,
        text: line.text,
        from,
        durationFrames,
        pauseFrames,
        ...(entry ? { audioDurationMs: (entry.samples * 1000) / entry.sampleRate } : {}),
        ...(bound?.cue.subtitles ? { subtitles: bound.cue.subtitles } : {}),
      });
    }
    impact ??= result ?? 0;
    if (result !== undefined && (!shot.scene.resolution || result < impact))
      fail(`result_cue_invalid:${scene.id}`);
    if (shot.scene.resolution && result === undefined) fail(`result_cue_missing:${scene.id}`);
    const existing = edits.get(shot.id);
    const dialogue = scene.lines.filter((line) => line.kind === "dialogue");
    if (
      dialogue.length &&
      (shot.scene.kind !== "speech" || dialogue.some((line) => line.speaker !== shot.scene.speaker))
    )
      fail(`dialogue_source_invalid:${scene.id}`);
    const { camera, layers } = retimeSpeechVisuals(shot, cursor, {
      start: 0,
      impact,
      ...(result === undefined ? {} : { result }),
      end: cursor - 1,
      ...Object.fromEntries(lines.map((line) => [`speech:${line.id}`, line.from])),
    });
    edits.set(shot.id, {
      ...existing,
      id: shot.id,
      durationFrames: cursor,
      readingClock: "flow",
      speech,
      camera,
      layers,
      scene: {
        ...existing?.scene,
        title: scene.title,
        ...(!dialogue.length && scene.lines.every((line) => line.speaker === speech[0]!.speaker)
          ? { speaker: speech[0]!.speaker }
          : {}),
        ...(dialogue.length ? { body: dialogue.map((line) => line.text).join("") } : {}),
        cues: {
          establish: 0,
          travel: Math.min(impact, Math.round(plan.fps * 0.05)),
          impact,
          settled: result ?? Math.min(cursor - 1, impact + Math.round(plan.fps * 0.2)),
        },
      },
    });
    timeline.scenes.push({
      id: shot.id,
      from: timeline.durationFrames,
      durationFrames: cursor,
      lines,
    });
    timeline.durationFrames += cursor;
  }
  return {
    script: { ...script, media: [...media.values()], shotEdits: [...edits.values()] },
    timeline,
  };
}
